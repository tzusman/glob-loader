"use strict";

var glob = require("glob");
var globArray = require('./glob-array');
var path = require("path");
var loaderUtils = require("loader-utils");

module.exports = function (content, sourceMap) {
  this.cacheable && this.cacheable();

  var query = loaderUtils.parseQuery(this.query);

  if (query.pattern) {
    return content;
  }

  var resourceDir = path.dirname(this.resourcePath);
  content = require(this.resourcePath);

  var getObject = function(key) {
    var config = content[key];
    var files = globArray.sync(config.glob, {
      cwd: resourceDir
    });

    if (!files.length) {
      this.emitWarning('Did not find anything for glob key ["' + key + '"] in directory "' + resourceDir + '"');
    }

    return generateObject.call(this, files, resourceDir, config);
  }.bind(this);

  if (query.section) {
    return 'module.exports = ' + getObject(query.section);
  }

  var objects = Object.keys(content).map(function(key) {
    var object = getObject(key);
    return JSON.stringify(key) + ': ' + object;
  }, this);

  var result = 'module.exports = {\n' + objects.join(',\n') + '\n};'
  return result;
};


// var request = loaderUtils.stringifyRequest(this, remainingRequest);

module.exports.pitch = function(remainingRequest, precedingRequest, data) {
  this.cacheable && this.cacheable();

  var query = loaderUtils.parseQuery(this.query);
  var resourceDir;

  if (query.pattern) {
    var issuer;

    if (typeof this._module.issuer === 'string') {
      issuer = this._module.issuer;
    } else {
      issuer = this._module.issuer.resource;
    }

    var issuerIndex = issuer.lastIndexOf('!');

    if (issuerIndex !== -1) {
      issuer = issuer.slice(issuerIndex + 1);
    }

    return handle.call(this, query, issuer);
  }
};

function handle(query, issuer) {
  var resourceDir = path.dirname(issuer);

  var files = glob.sync(query.pattern, {
    cwd: resourceDir
  });

  if (!files.length) {
    this.emitWarning('Did not find anything for glob "' + query.pattern + '" in directory "' + resourceDir + '"');
  }

  var result = 'module.exports = {\n' + files.map(function (file) {
    var dep = path.resolve(resourceDir, file);
    this.addDependency(dep);

    var stringifiedFile = JSON.stringify(file);
    var stringifiedDep = JSON.stringify(dep);
    return '\t' + stringifiedFile + ': require(' + stringifiedDep + ')';
  }, this).join(',\n') + '\n};';

  return result;
}

function generateObject(files, resourceDir, config) {
  var rewrite = config.rewrite;
  var needExport = config.export === false ? false : true;

  var result = files.map(function (file) {
    var dependency = path.resolve(resourceDir, file);
    this.addDependency(dependency);

    var stringifiedDep = JSON.stringify(dependency);
    var requireString = 'require(' + stringifiedDep + ')';

    if (needExport) {
      var stringifiedFile = JSON.stringify(rewrite ? rewrite(file) : file);
      return '\t' + stringifiedFile + ': ' + requireString;
    } else {
      return requireString;
    }
  }, this);

  if (needExport) {
    return '({\n' + result.join(',\n') + '\n})';
  } else {
    return '(' + result.join(', ') + ', null)';
  }
}