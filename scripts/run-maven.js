const path = require('node:path');
const { spawn } = require('node:child_process');

const backend = path.resolve(__dirname, '..', 'backend');
const wrapper = path.join(backend, process.platform === 'win32' ? 'mvnw.cmd' : 'mvnw');
const processHandle = spawn(wrapper, ['-f', 'pom.xml', ...process.argv.slice(2)], {
  cwd: backend,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

processHandle.on('error', (error) => {
  console.error(`Could not start the Maven Wrapper: ${error.message}`);
  process.exitCode = 1;
});
processHandle.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
