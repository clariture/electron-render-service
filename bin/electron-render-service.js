#!/usr/bin/env node

const path = require('path');
const electron = require('electron');
const proc = require('child_process');

const args = path.join(__dirname, '../lib/server.js');
const child = proc.spawn(electron, ['--disable-gpu', args], { stdio: 'inherit' });

child.on('close', code => process.exit(code));
