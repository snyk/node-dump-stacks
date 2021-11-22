const enabled = process.env['DUMP_STACKS_ENABLED'] !== 'false';
const addon = enabled ? require('node-gyp-build')(__dirname) : {};
module.exports = {
  native: addon,
  subscribeToEvents: (fp) => {
    global.NODE_DUMP_STACKS_CALLBACK = fp;
  },
};
