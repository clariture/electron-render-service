'use strict';

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _morgan = require('morgan');

var _morgan2 = _interopRequireDefault(_morgan);

var _bodyParser = require('body-parser');

var _bodyParser2 = _interopRequireDefault(_bodyParser);

var _responseTime = require('response-time');

var _responseTime2 = _interopRequireDefault(_responseTime);

var _electron = require('electron');

var _window_pool = require('./window_pool');

var _window_pool2 = _interopRequireDefault(_window_pool);

var _auth = require('./auth');

var _auth2 = _interopRequireDefault(_auth);

var _util = require('./util');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const INTERFACE = process.env.INTERFACE || '0.0.0.0';
const PORT = process.env.PORT || 3000;
const app = (0, _express2.default)();

app.use((0, _responseTime2.default)());

// Log with token
_morgan2.default.token('key-label', req => req.keyLabel);
app.use((0, _morgan2.default)(`[:date[iso]] :key-label@:remote-addr - :method :status
 :url :res[content-length] ":user-agent" :response-time ms`.replace('\n', '')));

app.use(_bodyParser2.default.json()); // for parsing application/json
app.use(_bodyParser2.default.urlencoded({ extended: false })); // for parsing application/x-www-form-urlencoded

app.disable('x-powered-by');
app.enable('trust proxy');

/**
 * GET /pdf - Render PDF
 *
 * Query params: https://github.com/atom/electron/blob/master/docs/api/web-contents.md#webcontentsprinttopdfoptions-callback
 * removePrintMedia - removes <link media="print"> stylesheets
 */
const processPDF = params => {
  return (req, res) => {
    var _params$url = params.url;
    const url = _params$url === undefined ? `data:text/plain;charset=utf-8,${ (0, _util.printUsage)('pdf') }` : _params$url;
    var _params$removePrintMe = params.removePrintMedia;
    const removePrintMedia = _params$removePrintMe === undefined ? 'false' : _params$removePrintMe;
    var _params$marginsType = params.marginsType;
    const marginsType = _params$marginsType === undefined ? 0 : _params$marginsType;
    var _params$pageSize = params.pageSize;
    const pageSize = _params$pageSize === undefined ? 'A4' : _params$pageSize;
    var _params$printBackgrou = params.printBackground;
    const printBackground = _params$printBackgrou === undefined ? 'true' : _params$printBackgrou;
    var _params$landscape = params.landscape;
    const landscape = _params$landscape === undefined ? 'false' : _params$landscape;


    req.app.pool.enqueue({ url: url, type: 'pdf',
      options: {
        pageSize: pageSize,
        marginsType: parseInt(marginsType, 10),
        landscape: landscape === 'true',
        printBackground: printBackground === 'true',
        removePrintMedia: removePrintMedia === 'true'
      }
    }, (err, buffer) => {
      if ((0, _util.handleErrors)(err, req, res)) return;

      (0, _util.setContentDisposition)(res, 'pdf');
      res.type('pdf').send(buffer);
    });
  };
};

app.get('/pdf', _auth2.default, (req, res) => {
  processPDF(req.query)(req, res);
});

app.post('/pdf', _auth2.default, (req, res) => {
  processPDF(req.body)(req, res);
});

/**
 * GET /png|jpeg - Render png or jpeg
 *
 * Query params:
 * x = 0, y = 0, width, height
 * quality = 80 - JPEG quality
 */
const processImage = params => {
  return (req, res) => {
    const type = req.params[0];
    var _params$url2 = params.url;
    const url = _params$url2 === undefined ? `data:text/plain;charset=utf-8,${ (0, _util.printUsage)(type) }` : _params$url2;


    req.app.pool.enqueue({ url: url, type: type, options: params }, (err, buffer) => {
      if ((0, _util.handleErrors)(err, req, res)) return;

      (0, _util.setContentDisposition)(res, type);
      res.type(type).send(buffer);
    });
  };
};

app.get(/^\/(png|jpeg)/, _auth2.default, (req, res) => {
  processImage(req.query)(req, res);
});

app.post(/^\/(png|jpeg)/, _auth2.default, (req, res) => {
  processImage(req.body)(req, res);
});

/**
 * GET /stats - Output some stats as JSON
 */
app.get('/stats', _auth2.default, (req, res) => {
  if (req.keyLabel !== 'global') return res.sendStatus(403);

  res.send(req.app.pool.stats());
});

/**
 * GET / - Print usage
 */
app.get('/', (req, res) => {
  res.send((0, _util.printUsage)());
});

// Electron finished booting
_electron.app.on('ready', () => {
  app.pool = new _window_pool2.default();
  const listener = app.listen(PORT, INTERFACE, () => (0, _util.printBootMessage)(listener));
});

// Stop Electron on SIG*
process.on('exit', code => _electron.app.exit(code));

// Passthrough error handler to silence Electron prompt
process.on('uncaughtException', err => {
  throw err;
});