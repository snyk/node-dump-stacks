#include <cinttypes>
#include <cstdlib>
#include <pthread.h>

#include <nan.h>
#include <uv.h>

static uint64_t wall_clock_time_ms() { return uv_hrtime() / 1000 / 1000; }

// returns true if successful, false if queued an exception
static bool create_thread(void *(*thread_main)(void *unused)) {
  pthread_attr_t attr = {};
  if (0 != pthread_attr_init(&attr)) {
    Nan::ThrowError("pthread_attr_init");
    return false;
  }

  // thin down the thread; optional
  pthread_attr_setstacksize(&attr, PTHREAD_STACK_MIN);
  pthread_attr_setdetachstate(&attr, PTHREAD_CREATE_DETACHED);

  sigset_t sigmask = {}, previous = {};
  if (0 != sigfillset(&sigmask)) {
    Nan::ThrowError("sigfillset");
    return false;
  }
  if (0 != pthread_sigmask(SIG_SETMASK, &sigmask, &previous)) {
    Nan::ThrowError("pthread_sigmask (set)");
    return false;
  }

  pthread_t thread;
  const int err = pthread_create(&thread, &attr, thread_main, nullptr);

  if (0 != pthread_sigmask(SIG_SETMASK, &previous, nullptr)) {
    Nan::ThrowError("pthread_sigmask (restore)");
    return false;
  }
  if (0 != pthread_attr_destroy(&attr)) {
    Nan::ThrowError("pthread_attr_destroy");
    return false;
  }

  if (0 != err) {
    Nan::ThrowError("creating thread");
    return false;
  }

  return true;
}

static uint64_t getenv_u64_or(const char *name, uint64_t fallback) {
  const char *raw = std::getenv(name);
  if (!raw) {
    return fallback;
  }

  char *end;
  const uint64_t val = std::strtoull(raw, &end, 10);

  if (0 == val && *end) {
    std::stringstream ss;
    ss << "invalid input for env var `" << name << "`: `" << raw << "`; had `"
       << end << "` remaining.";
    Nan::ThrowError(ss.str().c_str());
  }

  return val;
}
