require('..');

const durationMs = parseInt(process.argv[2], 10);
burnFor(durationMs);

const spin = async () => new Promise((resolve) => setImmediate(resolve));

void (async () => {
  await spin();
  burnFor(durationMs);
  await spin();
  burnFor(durationMs);
  // wake back up so the block can be reported
  setTimeout(() => {}, 100);
})();

function burnFor(durationMs) {
  const start = Date.now();

  while (Date.now() - start < durationMs) {
    let msg = '';
    for (let i = 0; i < 100000; ++i) {
      msg += i;
    }
    if (msg.includes('potato')) {
      return;
    }
  }
}
