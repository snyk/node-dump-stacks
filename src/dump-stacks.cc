#include <atomic>
#include <ctime>
#include <iomanip>
#include <iostream>

#include <nan.h>

#include "stacks.h"
#include "stringify.h"
#include "sys.h"

/// static internals; set in init and read elsewhere
static uv_timer_t loop_watcher_timer = {};
static v8::Isolate *init_isolate = nullptr;
static std::atomic_bool already_initialised(false);

/// config; written in init and read from elsewhere
static uint64_t check_loop_every_ms = 100;
static uint64_t report_after_block_time_ms = 1000;

/// set in Init and updated/read only in timer
static uint64_t ignore_initial_spins = 1;

/// shared between the timer and the worker thread
static std::atomic_uint64_t loop_last_alive_ms(0);
static std::atomic_uint64_t blocked_since_ms(0);
static std::atomic_bool was_blocked(false);

// shared between timer and the printer
static std::atomic_uint64_t notice_time(0);

// this isn't shared; only written/read from the interrupts
// interrupts are assumed to be executed in order (which is currently true)
static std::string last_stack = "";

void interrupt_capture(v8::Isolate *isolate, void *_data) {
  last_stack = current_stack_trace(isolate);
}

std::string to_iso_time(uint64_t when) {
  std::time_t when_time = when;
  std::ostringstream ss;
  ss << std::put_time(std::gmtime(&when_time), "%FT%TZ");
  return ss.str();
}

void interrupt_dump(v8::Isolate *_isolate, void *_data) {
  const uint64_t loop_blocked_ms = loop_last_alive_ms - blocked_since_ms;

  std::ostringstream out;

  out << R"({"name":"dump-stacks","message":"event loop blocked","blockedMs":)";
  out << loop_blocked_ms;
  out << R"(,"noticeTime":")" << to_iso_time(notice_time) << "\"";
  out << R"(,"stack":")" << escape_json_string(last_stack) << "\"";
  out << "}";

  std::cerr << out.str() << std::endl;
}

[[noreturn]] void *worker_thread_main(void *unused) {
  for (;;) {
    uv_sleep(check_loop_every_ms);

    if (!loop_last_alive_ms)
      continue;

    if (was_blocked) {
      if (blocked_since_ms != loop_last_alive_ms) {
        was_blocked = false;
        init_isolate->RequestInterrupt(interrupt_dump, nullptr);
      }
      continue;
    }

    uint64_t loop_blocked_ms = wall_clock_time_ms() - loop_last_alive_ms;
    if (loop_blocked_ms < report_after_block_time_ms) {
      continue;
    }

    // record the wall-clock when we think the event loop stopped working, ish
    // distinct from the uv_now() time, which is more accurate, but harder to
    // convert to wall-clock time
    notice_time = std::time(NULL);

    was_blocked = true;

    // we need the cast to make it clear to the compiler we're only taking the
    // value, not expecting any thread safety
    blocked_since_ms = static_cast<uint64_t>(loop_last_alive_ms);
    init_isolate->RequestInterrupt(interrupt_capture, nullptr);
  }
}

void record_loop_times(uv_timer_t *timer) {
  if (ignore_initial_spins > 0) {
    ignore_initial_spins -= 1;
    return;
  }
  loop_last_alive_ms = uv_now(timer->loop);
}

void Init(v8::Local<v8::Object> exports, v8::Local<v8::Value> _module,
          void *_priv) {
  if (already_initialised) {
    Nan::ThrowError("this module cannot be loaded twice in a process");
    return;
  }
  already_initialised = true;

  const uint64_t observe_loop_timing_ms =
      getenv_u64_or("DUMP_STACKS_OBSERVE_MS", 100);
  check_loop_every_ms = getenv_u64_or("DUMP_STACKS_CHECK_MS", 100);
  report_after_block_time_ms =
      getenv_u64_or("DUMP_STACKS_REPORT_ONCE_MS", 1000);
  ignore_initial_spins = getenv_u64_or("DUMP_STACKS_IGNORE_INITIAL_SPINS", 1);

  init_isolate = v8::Isolate::GetCurrent();

  if (0 != uv_timer_init(Nan::GetCurrentEventLoop(), &loop_watcher_timer)) {
    return Nan::ThrowError("creating timer");
  }
  if (0 != uv_timer_start(&loop_watcher_timer, record_loop_times,
                          observe_loop_timing_ms, observe_loop_timing_ms)) {
    return Nan::ThrowError("starting timer");
  }

  // prevent the timer from interfering with process shutdown
  uv_unref(reinterpret_cast<uv_handle_t *>(&loop_watcher_timer));

  if (!create_thread(worker_thread_main)) {
    return;
  }

  v8::Local<v8::Context> context =
#if NODE_MAJOR_VERSION >= 16
      // available from >= 16
      exports->GetCreationContext().ToLocalChecked();
#else
      // deprecated in >=18
      exports->CreationContext();
#endif

  exports->Set(context, Nan::New("ready").ToLocalChecked(), Nan::New(true))
      .ToChecked();
}

NODE_MODULE(dump_stacks, Init)
