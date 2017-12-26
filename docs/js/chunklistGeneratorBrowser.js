(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function placeHoldersCount (b64) {
  var len = b64.length
  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // the number of equal signs (place holders)
  // if there are two placeholders, than the two characters before it
  // represent one byte
  // if there is only one, then the three characters before it represent 2 bytes
  // this is just a cheap hack to not do indexOf twice
  return b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0
}

function byteLength (b64) {
  // base64 is 4/3 + up to two characters of the original data
  return (b64.length * 3 / 4) - placeHoldersCount(b64)
}

function toByteArray (b64) {
  var i, l, tmp, placeHolders, arr
  var len = b64.length
  placeHolders = placeHoldersCount(b64)

  arr = new Arr((len * 3 / 4) - placeHolders)

  // if there are placeholders, only get up to the last complete 4 chars
  l = placeHolders > 0 ? len - 4 : len

  var L = 0

  for (i = 0; i < l; i += 4) {
    tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)]
    arr[L++] = (tmp >> 16) & 0xFF
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  if (placeHolders === 2) {
    tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[L++] = tmp & 0xFF
  } else if (placeHolders === 1) {
    tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var output = ''
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    output += lookup[tmp >> 2]
    output += lookup[(tmp << 4) & 0x3F]
    output += '=='
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + (uint8[len - 1])
    output += lookup[tmp >> 10]
    output += lookup[(tmp >> 4) & 0x3F]
    output += lookup[(tmp << 2) & 0x3F]
    output += '='
  }

  parts.push(output)

  return parts.join('')
}

},{}],2:[function(require,module,exports){
//========================================================================================
// Globals
//========================================================================================

var Context = require("./context").Context;

var PRIMITIVE_TYPES = {
    'UInt8'    : 1,
    'UInt16LE' : 2,
    'UInt16BE' : 2,
    'UInt32LE' : 4,
    'UInt32BE' : 4,
    'Int8'     : 1,
    'Int16LE'  : 2,
    'Int16BE'  : 2,
    'Int32LE'  : 4,
    'Int32BE'  : 4,
    'FloatLE'  : 4,
    'FloatBE'  : 4,
    'DoubleLE' : 8,
    'DoubleBE' : 8
};

var SPECIAL_TYPES = {
    'String'   : null,
    'Buffer'   : null,
    'Array'    : null,
    'Skip'     : null,
    'Choice'   : null,
    'Nest'     : null,
    'Bit'      : null
};

var aliasRegistry = {};
var FUNCTION_PREFIX = '___parser_';

var BIT_RANGE = [];
(function() {
    var i;
    for (i = 1; i <= 32; i++) {
        BIT_RANGE.push(i);
    }
})();

// Converts Parser's method names to internal type names
var NAME_MAP = {};
Object.keys(PRIMITIVE_TYPES)
    .concat(Object.keys(SPECIAL_TYPES))
    .forEach(function(type) {
        NAME_MAP[type.toLowerCase()] = type;
    });

//========================================================================================
// class Parser
//========================================================================================

//----------------------------------------------------------------------------------------
// constructor
//----------------------------------------------------------------------------------------

var Parser = function() {
    this.varName = '';
    this.type = '';
    this.options = {};
    this.next = null;
    this.head = null;
    this.compiled = null;
    this.endian = 'be';
    this.constructorFn = null;
    this.alias = null;
};

//----------------------------------------------------------------------------------------
// public methods
//----------------------------------------------------------------------------------------

Parser.start = function() {
    return new Parser();
};

Object.keys(PRIMITIVE_TYPES)
    .forEach(function(type) {
        Parser.prototype[type.toLowerCase()] = function(varName, options) {
            return this.setNextParser(type.toLowerCase(), varName, options);
        };

        var typeWithoutEndian = type.replace(/BE|LE/, '').toLowerCase();
        if (!(typeWithoutEndian in Parser.prototype)) {
            Parser.prototype[typeWithoutEndian] = function(varName, options) {
                return this[typeWithoutEndian + this.endian](varName, options);
            };
        }
    });

BIT_RANGE.forEach(function(i) {
    Parser.prototype['bit' + i.toString()] = function(varName, options) {
        if (!options) {
            options = {};
        }
        options.length = i;
        return this.setNextParser('bit', varName, options);
    };
});

Parser.prototype.namely = function(alias) {
    aliasRegistry[alias] = this;
    this.alias = alias;
    return this;
}

Parser.prototype.skip = function(length, options) {
    if (options && options.assert) {
        throw new Error('assert option on skip is not allowed.');
    }

    return this.setNextParser('skip', '', {length: length});
};

Parser.prototype.string = function(varName, options) {
    if (!options.zeroTerminated && !options.length && !options.greedy) {
        throw new Error('Neither length, zeroTerminated, nor greedy is defined for string.');
    }
    if ((options.zeroTerminated || options.length) && options.greedy) {
        throw new Error('greedy is mutually exclusive with length and zeroTerminated for string.');
    }
    if (options.stripNull && !(options.length || options.greedy)) {
        throw new Error('Length or greedy must be defined if stripNull is defined.');
    }
    options.encoding = options.encoding || 'utf8';

    return this.setNextParser('string', varName, options);
};

Parser.prototype.buffer = function(varName, options) {
    if (!options.length && !options.readUntil) {
        throw new Error('Length nor readUntil is defined in buffer parser');
    }

    return this.setNextParser('buffer', varName, options);
};

Parser.prototype.array = function(varName, options) {
    if (!options.readUntil && !options.length && !options.lengthInBytes) {
        throw new Error('Length option of array is not defined.');
    }
    if (!options.type) {
        throw new Error('Type option of array is not defined.');
    }
    if ((typeof options.type === 'string') && !aliasRegistry[options.type]
        && Object.keys(PRIMITIVE_TYPES).indexOf(NAME_MAP[options.type]) < 0) {
        throw new Error('Specified primitive type "' + options.type + '" is not supported.');
    }

    return this.setNextParser('array', varName, options);
};

Parser.prototype.choice = function(varName, options) {
    if (!options.tag) {
        throw new Error('Tag option of array is not defined.');
    }
    if (!options.choices) {
        throw new Error('Choices option of array is not defined.');
    }
    Object.keys(options.choices).forEach(function(key) {
        if (isNaN(parseInt(key, 10))) {
            throw new Error('Key of choices must be a number.');
        }
        if (!options.choices[key]) {
            throw new Error('Choice Case ' + key + ' of ' + varName + ' is not valid.');
        }

        if ((typeof options.choices[key] === 'string') && !aliasRegistry[options.choices[key]]
            && (Object.keys(PRIMITIVE_TYPES).indexOf(NAME_MAP[options.choices[key]]) < 0)) {
            throw new Error('Specified primitive type "' +  options.choices[key] + '" is not supported.');
        }
    }, this);

    return this.setNextParser('choice', varName, options);
};

Parser.prototype.nest = function(varName, options) {
    if (!options.type) {
        throw new Error('Type option of nest is not defined.');
    }

    if (!(options.type instanceof Parser) && !aliasRegistry[options.type]) {
        throw new Error('Type option of nest must be a Parser object.');
    }

    return this.setNextParser('nest', varName, options);
};

Parser.prototype.endianess = function(endianess) {
    switch (endianess.toLowerCase()) {
    case 'little':
        this.endian = 'le';
        break;
    case 'big':
        this.endian = 'be';
        break;
    default:
        throw new Error('Invalid endianess: ' + endianess);
    }

    return this;
};

Parser.prototype.create = function(constructorFn) {
    if (!(constructorFn instanceof Function)) {
        throw new Error('Constructor must be a Function object.');
    }

    this.constructorFn = constructorFn;

    return this;
};

Parser.prototype.getCode = function() {
    var ctx = new Context();

    ctx.pushCode('if (false) {');
    ctx.generateError('"argument buffer is not a Buffer object"');
    ctx.pushCode('}');

    if (!this.alias) {
        this.addRawCode(ctx);
    } else {
        this.addAliasedCode(ctx);
    }

    if (this.alias) {
        ctx.pushCode('return {0}(0).result;', FUNCTION_PREFIX + this.alias);
    } else {
        ctx.pushCode('return vars;');
    }

    return ctx.code;
};

Parser.prototype.addRawCode = function(ctx) {
    ctx.pushCode('var offset = 0;');

    if (this.constructorFn) {
        ctx.pushCode('var vars = new constructorFn();');
    } else {
        ctx.pushCode('var vars = {};');
    }

    this.generate(ctx);

    this.resolveReferences(ctx);

    ctx.pushCode('return vars;');
};

Parser.prototype.addAliasedCode = function(ctx) {
    ctx.pushCode('function {0}(offset) {', FUNCTION_PREFIX + this.alias);

    if (this.constructorFn) {
        ctx.pushCode('var vars = new constructorFn();');
    } else {
        ctx.pushCode('var vars = {};');
    }

    this.generate(ctx);

    ctx.markResolved(this.alias);
    this.resolveReferences(ctx);

    ctx.pushCode('return { offset: offset, result: vars };');
    ctx.pushCode('}');

    return ctx;
};

Parser.prototype.resolveReferences = function(ctx) {
    var references = ctx.getUnresolvedReferences();
    ctx.markRequested(references);
    references.forEach(function(alias) {
        var parser = aliasRegistry[alias];
        parser.addAliasedCode(ctx);
    });
};

Parser.prototype.compile = function() {
    this.compiled = new Function('buffer', 'callback', 'constructorFn', this.getCode());
};

Parser.prototype.sizeOf = function() {
    var size = NaN;

    if (Object.keys(PRIMITIVE_TYPES).indexOf(this.type) >= 0) {
        size = PRIMITIVE_TYPES[this.type];

    // if this is a fixed length string
    } else if (this.type === 'String' && typeof this.options.length === 'number') {
        size = this.options.length;

    // if this is a fixed length buffer
    } else if (this.type === 'Buffer' && typeof this.options.length === 'number') {
        size = this.options.length;

    // if this is a fixed length array
    } else if (this.type === 'Array' && typeof this.options.length === 'number') {
        var elementSize = NaN;
        if (typeof this.options.type === 'string'){
            elementSize = PRIMITIVE_TYPES[NAME_MAP[this.options.type]];
        } else if (this.options.type instanceof Parser) {
            elementSize = this.options.type.sizeOf();
        }
        size = this.options.length * elementSize;

    // if this a skip
    } else if (this.type === 'Skip') {
        size = this.options.length;

    // if this is a nested parser
    } else if (this.type === 'Nest') {
        size = this.options.type.sizeOf();
    } else if (!this.type) {
        size = 0;
    }

    if (this.next) {
        size += this.next.sizeOf();
    }

    return size;
};

// Follow the parser chain till the root and start parsing from there
Parser.prototype.parse = function(buffer, callback) {
    if (!this.compiled) {
        this.compile();
    }

    return this.compiled(buffer, callback, this.constructorFn);
};

//----------------------------------------------------------------------------------------
// private methods
//----------------------------------------------------------------------------------------

Parser.prototype.setNextParser = function(type, varName, options) {
    var parser = new Parser();

    parser.type = NAME_MAP[type];
    parser.varName = varName;
    parser.options = options || parser.options;
    parser.endian = this.endian;

    if (this.head) {
        this.head.next = parser;
    } else {
        this.next = parser;
    }
    this.head = parser;

    return this;
};

// Call code generator for this parser
Parser.prototype.generate = function(ctx) {
    if (this.type) {
        this['generate' + this.type](ctx);
        this.generateAssert(ctx);
    }

    var varName = ctx.generateVariable(this.varName);
    if (this.options.formatter) {
        this.generateFormatter(ctx, varName, this.options.formatter);
    }

    return this.generateNext(ctx);
};

Parser.prototype.generateAssert = function(ctx) {
    if (!this.options.assert) {
        return;
    }

    var varName = ctx.generateVariable(this.varName);

    switch (typeof this.options.assert) {
        case 'function':
            ctx.pushCode('if (!({0}).call(vars, {1})) {', this.options.assert, varName);
        break;
        case 'number':
            ctx.pushCode('if ({0} !== {1}) {', this.options.assert, varName);
        break;
        case 'string':
            ctx.pushCode('if ("{0}" !== {1}) {', this.options.assert, varName);
        break;
        default:
            throw new Error('Assert option supports only strings, numbers and assert functions.');
    }
    ctx.generateError('"Assert error: {0} is " + {0}', varName);
    ctx.pushCode('}');
};

// Recursively call code generators and append results
Parser.prototype.generateNext = function(ctx) {
    if (this.next) {
        ctx = this.next.generate(ctx);
    }

    return ctx;
};

Object.keys(PRIMITIVE_TYPES).forEach(function(type) {
    Parser.prototype['generate' + type] = function(ctx) {
        ctx.pushCode('{0} = buffer.read{1}(offset);', ctx.generateVariable(this.varName), type);
        ctx.pushCode('offset += {0};', PRIMITIVE_TYPES[type]);
    };
});

Parser.prototype.generateBit = function(ctx) {
    // TODO find better method to handle nested bit fields
    var parser = JSON.parse(JSON.stringify(this));
    parser.varName = ctx.generateVariable(parser.varName);
    ctx.bitFields.push(parser);

    if (!this.next || (this.next && ['Bit', 'Nest'].indexOf(this.next.type) < 0)) {
        var sum = 0;
        ctx.bitFields.forEach(function(parser) {
            sum += parser.options.length;
        });

        var val = ctx.generateTmpVariable();

        if (sum <= 8) {
            ctx.pushCode('var {0} = buffer.readUInt8(offset);', val);
            sum = 8;
        } else if (sum <= 16) {
            ctx.pushCode('var {0} = buffer.readUInt16BE(offset);', val);
            sum = 16;
        } else if (sum <= 24) {
            var val1 = ctx.generateTmpVariable();
            var val2 = ctx.generateTmpVariable();
            ctx.pushCode('var {0} = buffer.readUInt16BE(offset);', val1);
            ctx.pushCode('var {0} = buffer.readUInt8(offset + 2);', val2);
            ctx.pushCode('var {2} = ({0} << 8) | {1};', val1, val2, val);
            sum = 24;
        } else if (sum <= 32) {
            ctx.pushCode('var {0} = buffer.readUInt32BE(offset);', val);
            sum = 32;
        } else {
            throw new Error('Currently, bit field sequence longer than 4-bytes is not supported.');
        }
        ctx.pushCode('offset += {0};', sum / 8);

        var bitOffset = 0;
        var isBigEndian = this.endian === 'be';
        ctx.bitFields.forEach(function(parser) {
            ctx.pushCode('{0} = {1} >> {2} & {3};',
                parser.varName,
                val,
                isBigEndian ? sum - bitOffset - parser.options.length : bitOffset,
                (1 << parser.options.length) - 1
            );
            bitOffset += parser.options.length;
        });

        ctx.bitFields = [];
    }
};

Parser.prototype.generateSkip = function(ctx) {
    var length = ctx.generateOption(this.options.length);
    ctx.pushCode('offset += {0};', length);
};

Parser.prototype.generateString = function(ctx) {
    var name = ctx.generateVariable(this.varName);
    var start = ctx.generateTmpVariable();

    if (this.options.length && this.options.zeroTerminated) {
        ctx.pushCode('var {0} = offset;', start);
        ctx.pushCode('while(buffer.readUInt8(offset++) !== 0 && offset - {0}  < {1});',
            start,
            this.options.length
        );
        ctx.pushCode('{0} = buffer.toString(\'{1}\', {2}, offset - {2} < {3} ? offset - 1 : offset);',
            name,
            this.options.encoding,
            start,
            this.options.length
        );
    } else if(this.options.length) {
        ctx.pushCode('{0} = buffer.toString(\'{1}\', offset, offset + {2});',
                            name,
                            this.options.encoding,
                            ctx.generateOption(this.options.length)
                        );
        ctx.pushCode('offset += {0};', ctx.generateOption(this.options.length));
    } else if (this.options.zeroTerminated) {
        ctx.pushCode('var {0} = offset;', start);
        ctx.pushCode('while(buffer.readUInt8(offset++) !== 0);');
        ctx.pushCode('{0} = buffer.toString(\'{1}\', {2}, offset - 1);',
            name,
            this.options.encoding,
            start
        );
    } else if (this.options.greedy) {
        ctx.pushCode('var {0} = offset;', start);
        ctx.pushCode('while(buffer.length > offset++);');
        ctx.pushCode('{0} = buffer.toString(\'{1}\', {2}, offset);',
            name,
            this.options.encoding,
            start
        );
    }
    if(this.options.stripNull) {
        ctx.pushCode('{0} = {0}.replace(/\\x00+$/g, \'\')', name);
    }
};

Parser.prototype.generateBuffer = function(ctx) {
    if (this.options.readUntil === 'eof') {
        ctx.pushCode('{0} = buffer.slice(offset);',
            ctx.generateVariable(this.varName)
            );
    } else {
        ctx.pushCode('{0} = buffer.slice(offset, offset + {1});',
            ctx.generateVariable(this.varName),
            ctx.generateOption(this.options.length)
            );
        ctx.pushCode('offset += {0};', ctx.generateOption(this.options.length));
    }

    if (this.options.clone) {
        var buf = ctx.generateTmpVariable();

        ctx.pushCode('var {0} = new Buffer({1}.length);', buf, ctx.generateVariable(this.varName));
        ctx.pushCode('{0}.copy({1});', ctx.generateVariable(this.varName), buf);
        ctx.pushCode('{0} = {1}', ctx.generateVariable(this.varName), buf);
    }
};

Parser.prototype.generateArray = function(ctx) {
    var length = ctx.generateOption(this.options.length);
    var lengthInBytes = ctx.generateOption(this.options.lengthInBytes);
    var type = this.options.type;
    var counter = ctx.generateTmpVariable();
    var lhs = ctx.generateVariable(this.varName);
    var item = ctx.generateTmpVariable();
    var key = this.options.key;
    var isHash = typeof key === 'string';

    if (isHash) {
        ctx.pushCode('{0} = {};', lhs);
    } else {
        ctx.pushCode('{0} = [];', lhs);
    }
    if (typeof this.options.readUntil === 'function') {
        ctx.pushCode('do {');
    } else if (this.options.readUntil === 'eof') {
        ctx.pushCode('for (var {0} = 0; offset < buffer.length; {0}++) {', counter);
    } else if (lengthInBytes !== undefined) {
        ctx.pushCode('for (var {0} = offset; offset - {0} < {1}; ) {', counter, lengthInBytes);
    } else {
        ctx.pushCode('for (var {0} = 0; {0} < {1}; {0}++) {', counter, length);
    }

    if (typeof type === 'string') {
        if (!aliasRegistry[type]) {
            ctx.pushCode('var {0} = buffer.read{1}(offset);', item, NAME_MAP[type]);
            ctx.pushCode('offset += {0};', PRIMITIVE_TYPES[NAME_MAP[type]]);
        } else {
            var tempVar = ctx.generateTmpVariable();
            ctx.pushCode('var {0} = {1}(offset);', tempVar, FUNCTION_PREFIX + type);
            ctx.pushCode('var {0} = {1}.result; offset = {1}.offset;', item, tempVar);
            if (type !== this.alias) ctx.addReference(type);
        }
    } else if (type instanceof Parser) {
        ctx.pushCode('var {0} = {};', item);

        ctx.pushScope(item);
        type.generate(ctx);
        ctx.popScope();
    }

    if (isHash) {
        ctx.pushCode('{0}[{2}.{1}] = {2};', lhs, key, item);
    } else {
        ctx.pushCode('{0}.push({1});', lhs, item);
    }

    ctx.pushCode('}');

    if (typeof this.options.readUntil === 'function') {
        ctx.pushCode(' while (!({0}).call(this, {1}, buffer.slice(offset)));', this.options.readUntil, item);
    }
};

Parser.prototype.generateChoiceCase = function(ctx, varName, type) {
    if (typeof type === 'string') {
        if (!aliasRegistry[type]) {
            ctx.pushCode('{0} = buffer.read{1}(offset);', ctx.generateVariable(this.varName), NAME_MAP[type]);
            ctx.pushCode('offset += {0};', PRIMITIVE_TYPES[NAME_MAP[type]]);
        } else {
            var tempVar = ctx.generateTmpVariable();
            ctx.pushCode('var {0} = {1}(offset);', tempVar, FUNCTION_PREFIX + type);
            ctx.pushCode('{0} = {1}.result; offset = {1}.offset;', ctx.generateVariable(this.varName), tempVar);
            if (type !== this.alias) ctx.addReference(type);
        }
    } else if (type instanceof Parser) {
        ctx.pushPath(varName);
        type.generate(ctx);
        ctx.popPath(varName);
    }
};

Parser.prototype.generateChoice = function(ctx) {
    var tag = ctx.generateOption(this.options.tag);
    if (this.varName)
    {
        ctx.pushCode('{0} = {};', ctx.generateVariable(this.varName));
    }
    ctx.pushCode('switch({0}) {', tag);
    Object.keys(this.options.choices).forEach(function(tag) {
        var type = this.options.choices[tag];

        ctx.pushCode('case {0}:', tag);
        this.generateChoiceCase(ctx, this.varName, type);
        ctx.pushCode('break;');
    }, this);
    ctx.pushCode('default:');
    if (this.options.defaultChoice) {
        this.generateChoiceCase(ctx, this.varName, this.options.defaultChoice);
    } else {
        ctx.generateError('"Met undefined tag value " + {0} + " at choice"', tag);
    }
    ctx.pushCode('}');
};

Parser.prototype.generateNest = function(ctx) {
    var nestVar = ctx.generateVariable(this.varName);
    if (this.options.type instanceof Parser) {
        ctx.pushCode('{0} = {};', nestVar);
        ctx.pushPath(this.varName);
        this.options.type.generate(ctx);
        ctx.popPath(this.varName);
    } else if (aliasRegistry[this.options.type]) {
        var tempVar = ctx.generateTmpVariable();
        ctx.pushCode('var {0} = {1}(offset);', tempVar, FUNCTION_PREFIX + this.options.type);
        ctx.pushCode('{0} = {1}.result; offset = {1}.offset;', nestVar, tempVar);
        if (this.options.type !== this.alias) ctx.addReference(this.options.type);
    }
};

Parser.prototype.generateFormatter = function(ctx, varName, formatter) {
    if (typeof formatter === 'function') {
        ctx.pushCode('{0} = ({1}).call(this, {0});', varName, formatter);
    }
};

Parser.prototype.isInteger = function() {
    return !!this.type.match(/U?Int[8|16|32][BE|LE]?|Bit\d+/);
};

//========================================================================================
// Exports
//========================================================================================

exports.Parser = Parser;

},{"./context":3}],3:[function(require,module,exports){
//========================================================================================
// class Context
//========================================================================================

//----------------------------------------------------------------------------------------
// constructor
//----------------------------------------------------------------------------------------

var Context = function() {
    this.code = '';
    this.scopes = [['vars']];
    this.isAsync = false;
    this.bitFields = [];
    this.tmpVariableCount = 0;
    this.references = {};
};

//----------------------------------------------------------------------------------------
// public methods
//----------------------------------------------------------------------------------------

Context.prototype.generateVariable = function(name) {
    var arr = [];

    Array.prototype.push.apply(arr, this.scopes[this.scopes.length - 1]);
    if (name) {
        arr.push(name);
    }

    return arr.join('.');
};

Context.prototype.generateOption = function(val) {
    switch(typeof val) {
        case 'number':
            return val.toString();
        case 'string':
            return this.generateVariable(val);
        case 'function':
            return '(' + val + ').call(' + this.generateVariable() + ', vars)';
    }
};

Context.prototype.generateError = function() {
    var args = Array.prototype.slice.call(arguments);
    var err = Context.interpolate.apply(this, args);

    if (this.isAsync) {
        this.pushCode('return process.nextTick(function() { callback(new Error(' + err + '), vars); });');
    } else {
        this.pushCode('throw new Error(' + err + ');');
    }
};

Context.prototype.generateTmpVariable = function() {
    return '$tmp' + (this.tmpVariableCount++);
};

Context.prototype.pushCode = function() {
    var args = Array.prototype.slice.call(arguments);

    this.code += Context.interpolate.apply(this, args) + '\n';
};

Context.prototype.pushPath = function(name) {
    if (name)
    {
    	this.scopes[this.scopes.length - 1].push(name);
    }
};

Context.prototype.popPath = function(name) {
    if (name)
   { 
   	this.scopes[this.scopes.length - 1].pop();
   }
};

Context.prototype.pushScope = function(name) {
    this.scopes.push([name]);
};

Context.prototype.popScope = function() {
    this.scopes.pop();
};

Context.prototype.addReference = function(alias) {
    if (this.references[alias]) return;
    this.references[alias] = { resolved: false, requested: false };
};

Context.prototype.markResolved = function(alias) {
    this.references[alias].resolved = true;
};

Context.prototype.markRequested = function(aliasList) {
    aliasList.forEach(function(alias) {
        this.references[alias].requested = true;
    }.bind(this));
};

Context.prototype.getUnresolvedReferences = function() {
    var references = this.references;
    return Object.keys(this.references).filter(function(alias) {
        return !references[alias].resolved && !references[alias].requested;
    });
};

//----------------------------------------------------------------------------------------
// private methods
//----------------------------------------------------------------------------------------

Context.interpolate = function(s) {
    var re = /{\d+}/g;
    var matches = s.match(re);
    var params = Array.prototype.slice.call(arguments, 1);

    if (matches) {
        matches.forEach(function(match) {
            var index = parseInt(match.substr(1, match.length - 2), 10);
            s = s.replace(match, params[index].toString());
        });
    }

    return s;
};

exports.Context = Context;

},{}],4:[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

var K_MAX_LENGTH = 0x7fffffff
exports.kMaxLength = K_MAX_LENGTH

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
 *               implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * We report that the browser does not support typed arrays if the are not subclassable
 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
 * for __proto__ and has a buggy typed array implementation.
 */
Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport()

if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
    typeof console.error === 'function') {
  console.error(
    'This browser lacks typed array (Uint8Array) support which is required by ' +
    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
  )
}

function typedArraySupport () {
  // Can typed array instances can be augmented?
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = {__proto__: Uint8Array.prototype, foo: function () { return 42 }}
    return arr.foo() === 42
  } catch (e) {
    return false
  }
}

function createBuffer (length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('Invalid typed array length')
  }
  // Return an augmented `Uint8Array` instance
  var buf = new Uint8Array(length)
  buf.__proto__ = Buffer.prototype
  return buf
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new Error(
        'If encoding is specified then the first argument must be a string'
      )
    }
    return allocUnsafe(arg)
  }
  return from(arg, encodingOrOffset, length)
}

// Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
if (typeof Symbol !== 'undefined' && Symbol.species &&
    Buffer[Symbol.species] === Buffer) {
  Object.defineProperty(Buffer, Symbol.species, {
    value: null,
    configurable: true,
    enumerable: false,
    writable: false
  })
}

Buffer.poolSize = 8192 // not used by this implementation

function from (value, encodingOrOffset, length) {
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number')
  }

  if (isArrayBuffer(value)) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  return fromObject(value)
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length)
}

// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
Buffer.prototype.__proto__ = Uint8Array.prototype
Buffer.__proto__ = Uint8Array

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be a number')
  } else if (size < 0) {
    throw new RangeError('"size" argument must not be negative')
  }
}

function alloc (size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(size).fill(fill, encoding)
      : createBuffer(size).fill(fill)
  }
  return createBuffer(size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(size, fill, encoding)
}

function allocUnsafe (size) {
  assertSize(size)
  return createBuffer(size < 0 ? 0 : checked(size) | 0)
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(size)
}

function fromString (string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('"encoding" must be a valid string encoding')
  }

  var length = byteLength(string, encoding) | 0
  var buf = createBuffer(length)

  var actual = buf.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    buf = buf.slice(0, actual)
  }

  return buf
}

function fromArrayLike (array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  var buf = createBuffer(length)
  for (var i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255
  }
  return buf
}

function fromArrayBuffer (array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('\'offset\' is out of bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('\'length\' is out of bounds')
  }

  var buf
  if (byteOffset === undefined && length === undefined) {
    buf = new Uint8Array(array)
  } else if (length === undefined) {
    buf = new Uint8Array(array, byteOffset)
  } else {
    buf = new Uint8Array(array, byteOffset, length)
  }

  // Return an augmented `Uint8Array` instance
  buf.__proto__ = Buffer.prototype
  return buf
}

function fromObject (obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    var buf = createBuffer(len)

    if (buf.length === 0) {
      return buf
    }

    obj.copy(buf, 0, 0, len)
    return buf
  }

  if (obj) {
    if (isArrayBufferView(obj) || 'length' in obj) {
      if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
        return createBuffer(0)
      }
      return fromArrayLike(obj)
    }

    if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
      return fromArrayLike(obj.data)
    }
  }

  throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
}

function checked (length) {
  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= K_MAX_LENGTH) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return b != null && b._isBuffer === true
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (isArrayBufferView(string) || isArrayBuffer(string)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    string = '' + string
  }

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
      case undefined:
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
// reliably in a browserify context because there could be multiple different
// copies of the 'buffer' package in use. This method works even for Buffer
// instances that were created from another copy of the `buffer` package.
// See: https://github.com/feross/buffer/issues/154
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (!Buffer.isBuffer(target)) {
    throw new TypeError('Argument must be a Buffer')
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset  // Coerce to Number.
  if (numberIsNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (numberIsNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset >>> 0
    if (isFinite(length)) {
      length = length >>> 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256))
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf = this.subarray(start, end)
  // Return an augmented `Uint8Array` instance
  newBuf.__proto__ = Buffer.prototype
  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset + 3] = (value >>> 24)
  this[offset + 2] = (value >>> 16)
  this[offset + 1] = (value >>> 8)
  this[offset] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  this[offset + 2] = (value >>> 16)
  this[offset + 3] = (value >>> 24)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else if (len < 1000) {
    // ascending copy from start
    for (i = 0; i < len; ++i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, start + len),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if (code < 256) {
        val = code
      }
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : new Buffer(val, encoding)
    var len = bytes.length
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = str.trim().replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

// ArrayBuffers from another context (i.e. an iframe) do not pass the `instanceof` check
// but they should be treated as valid. See: https://github.com/feross/buffer/issues/166
function isArrayBuffer (obj) {
  return obj instanceof ArrayBuffer ||
    (obj != null && obj.constructor != null && obj.constructor.name === 'ArrayBuffer' &&
      typeof obj.byteLength === 'number')
}

// Node 0.10 supports `ArrayBuffer` but lacks `ArrayBuffer.isView`
function isArrayBufferView (obj) {
  return (typeof ArrayBuffer.isView === 'function') && ArrayBuffer.isView(obj)
}

function numberIsNaN (obj) {
  return obj !== obj // eslint-disable-line no-self-compare
}

},{"base64-js":1,"ieee754":5}],5:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],6:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function(path) {
  var result = splitPath(path),
      root = result[0],
      dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
};


exports.basename = function(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPath(path)[3];
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require('_process'))
},{"_process":7}],7:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],8:[function(require,module,exports){
const path = require('path');

const tspck = require('./tspacket.js');
const tspckParserMod = require('./tspacket_parser');

const hlsChunk = require('./hls_chunk.js');
const hlsChunklist = require('./hls_chunklist.js');

"use strict";

const TS_PACKET_SIZE = 188;

// Constructor
class chunklistGenerator {

    constructor(input_ts_file_name, target_segment_dur_s) {

        //Create packet parsers. According to the docs it is compiled at first call, so we can NOT create it inside packet (time consuming)
        this.tspckParser = new tspckParserMod.tspacketParser().getPacketParser();
        this.tspckPATParser = new tspckParserMod.tspacketParser().getPATPacketParser();
        this.tspckPMTParser = new tspckParserMod.tspacketParser().getPMTPacketParser();

        this.result_chunklist = "";

        this.segmenter_data = {
            config: {
                source: input_ts_file_name,
                packet_expected_length: TS_PACKET_SIZE,

                //Only 1 video allowed
                break_at_video_idr: true,
                target_segment_duration_s: target_segment_dur_s,
                target_segment_duration_tolerance: 0.25
            },

            //Params for read TS
            curr_file_pos_byte: 0,
            video_packet_pid: -1, //Autodetected (Usually is 0x100)
            segment_index: 0,
            bytes_next_sync: 0,

            //Obj used for parsing
            ts_packet: null,
            chunk: null,

            //Media init info (PAT + PMT)
            media_init_info: {
                set: false,
                pat: {
                    first_byte_pos: -1,
                    last_byte_pos: -1
                },
                pmt: {
                    id: -1,
                    first_byte_pos: -1,
                    last_byte_pos: -1
                },
                getFirstBytePos() {
                    let ret = -1;

                    if (this.set) ret = Math.min(this.pat.first_byte_pos, this.pmt.first_byte_pos);

                    return ret;
                },
                getLastBytePos() {
                    let ret = -1;

                    if (this.set) ret = Math.max(this.pat.last_byte_pos, this.pmt.last_byte_pos);

                    return ret;
                }
            },

            //Chunks info
            chunks_info: []
        };
    }

    processDataChunk(data, callback) {
        try {
            this._process_data_chunk(data);
        } catch (err) {
            return callback(err);
        }

        return callback(null);
    }

    processDataEnd(callback) {
        try {
            //Process remaining TS packets
            this._process_data_finish();

            //Generate chunklist
            let chunklist_generator = new hlsChunklist.hls_chunklist(path.basename(this.segmenter_data.config.source));

            //Set media init data
            chunklist_generator.setMediaIniInfo(this.segmenter_data.media_init_info);

            //Set chunks data
            chunklist_generator.setChunksInfo(this.segmenter_data.chunks_info);

            //Create HLS chunklist string
            this.result_chunklist = chunklist_generator.toString();
        } catch (err) {
            return callback(err, null);
        }

        return callback(null, this.result_chunklist);
    }

    _createNewChunk() {
        this.segmenter_data.chunk = new hlsChunk.hls_chunk(this.segmenter_data.segment_index);
        this.segmenter_data.segment_index++;
    }

    _process_data_finish() {
        //New chunk ***
        console.log("Last segment!, Index: " + this.segmenter_data.chunk.getIndex().toString() + ". Packets: " + this.segmenter_data.chunk.getNumTSPackets().toString() + ". Time: " + this.segmenter_data.chunk.getDuration().toString());

        this.segmenter_data.chunks_info.push(this.segmenter_data.chunk);

        this._createNewChunk();
    }

    _getMediaInfoData(ts_packet) {
        let ret = false;

        if (ts_packet.isPAT()) {
            let pmtsData = ts_packet.getPMTsIDs();
            if (Array.isArray(pmtsData) && pmtsData.length > 1) throw new Error("More than 1 PMT not supported!!");else this.segmenter_data.media_init_info.pmt.id = pmtsData[0].pmtID;

            this.segmenter_data.media_init_info.pat.first_byte_pos = this.segmenter_data.ts_packet.getFirstBytePos();
            this.segmenter_data.media_init_info.pat.last_byte_pos = this.segmenter_data.ts_packet.getLastBytePos();
        } else if (ts_packet.isID(this.segmenter_data.media_init_info.pmt.id)) {
            let esInfo = ts_packet.getESInfo();

            if (Array.isArray(esInfo)) {
                let i = 0;
                while (this.segmenter_data.video_packet_pid < 0 && i < esInfo.length) {

                    if (tspck.tspacket.isStreamTypeVideo(esInfo[i].streamType)) this.segmenter_data.video_packet_pid = esInfo[i].elementaryPID;

                    i++;
                }
            }

            this.segmenter_data.media_init_info.pmt.first_byte_pos = this.segmenter_data.ts_packet.getFirstBytePos();
            this.segmenter_data.media_init_info.pmt.last_byte_pos = this.segmenter_data.ts_packet.getLastBytePos();
        }

        //Media init complete
        if (this.segmenter_data.media_init_info.pat.first_byte_pos >= 0 && this.segmenter_data.media_init_info.pat.last_byte_pos >= 0 && this.segmenter_data.media_init_info.pmt.first_byte_pos >= 0 && this.segmenter_data.media_init_info.pmt.last_byte_pos >= 0) ret = true;

        return ret;
    }

    _process_data_chunk(data) {
        let curr_packet_start = 0;
        let curr_packet_end = 0;

        //Create initial packet
        if (this.segmenter_data.ts_packet === null) this.segmenter_data.ts_packet = new tspck.tspacket(this.segmenter_data.packet_size, this.tspckParser, this.tspckPATParser, this.tspckPMTParser);

        if (this.segmenter_data.chunk === null) this._createNewChunk();

        if (data.length <= this.segmenter_data.bytes_next_sync) {
            this.segmenter_data.bytes_next_sync = this.segmenter_data.bytes_next_sync - data.length;

            //Create ts packet buffet
            this.segmenter_data.ts_packet.addDataWithPos(this.segmenter_data.curr_file_pos_byte, data);
        } else {
            let sync_index = this.segmenter_data.bytes_next_sync;
            let bexit = false;
            while (bexit === false) {
                if (data[sync_index] === 0x47) {

                    //New packet detected
                    curr_packet_end = sync_index;
                    this.segmenter_data.ts_packet.addDataWithPos(this.segmenter_data.curr_file_pos_byte, data, curr_packet_start, curr_packet_end);

                    //Check if random access
                    let is_random_access_point = this.segmenter_data.ts_packet.isRandomAccess(this.segmenter_data.video_packet_pid);
                    if (is_random_access_point) console.log("(" + this.segmenter_data.video_packet_pid + ") Random access point (IDR)");

                    //If NOT 1st packet (0 length)
                    if (this.segmenter_data.is_first_packet === false) {

                        //Is next segment needed?
                        let next_segment = false;
                        if (this.segmenter_data.chunk.getDuration() >= this.segmenter_data.config.target_segment_duration_s - this.segmenter_data.config.target_segment_duration_tolerance) {
                            if (this.segmenter_data.config.break_at_video_idr) {
                                if (is_random_access_point) next_segment = true;
                            } else {
                                next_segment = true;
                            }
                        }

                        if (next_segment) {
                            //New chunk ***
                            console.log("Next segment!, Index: " + this.segmenter_data.chunk.getIndex().toString() + ". Packets: " + this.segmenter_data.chunk.getNumTSPackets().toString() + ". Time: " + this.segmenter_data.chunk.getDuration().toString());

                            this.segmenter_data.chunks_info.push(this.segmenter_data.chunk);

                            this._createNewChunk();
                        }

                        if (!this.segmenter_data.media_init_info.set) this.segmenter_data.media_init_info.set = this._getMediaInfoData(this.segmenter_data.ts_packet);else this.segmenter_data.chunk.addTSPacket(this.segmenter_data.ts_packet);

                        //New packet
                        this.segmenter_data.ts_packet = new tspck.tspacket(this.segmenter_data.packet_size, this.tspckParser, this.tspckPATParser, this.tspckPMTParser);
                        curr_packet_start = sync_index;
                    }

                    this.segmenter_data.is_first_packet = false;

                    //Next sync
                    if (sync_index + this.segmenter_data.config.packet_expected_length >= data.length) {
                        this.segmenter_data.bytes_next_sync = sync_index + this.segmenter_data.config.packet_expected_length - data.length;
                        bexit = true;

                        this.segmenter_data.ts_packet.addDataWithPos(this.segmenter_data.curr_file_pos_byte, data, curr_packet_start);
                    } else {
                        sync_index = sync_index + this.segmenter_data.config.packet_expected_length;
                    }
                } else {
                    throw new Error("Out of sync!! We need to improve the code to resync");
                }
            }
        }

        this.segmenter_data.curr_file_pos_byte += data.length;
    }
}

//Export class
module.exports.chunklistGenerator = chunklistGenerator;

},{"./hls_chunk.js":10,"./hls_chunklist.js":11,"./tspacket.js":12,"./tspacket_parser":13,"path":6}],9:[function(require,module,exports){
(function (Buffer){
const chkGenerator = require('./chunklistGenerator.js');

"use strict";

function checkFileAPI() {
    // Check for the various File API support.
    if (window.File && window.FileReader && window.FileList && window.Blob) {
        // Great success! All the File APIs are supported.
    } else {
        alert('The File APIs are not fully supported in this browser.');
    }
}

function chunklistGeneratorBrowser(file, target_duration, final_callback, progress_callback) {

    //Read the local file in the browser

    //Instantiate class
    let segmenter = new chkGenerator.chunklistGenerator(file.name, target_duration);

    parseFile(file, function (err, data_chunk, read, total) {
        if (err) {
            return final_callback(err, null);
        } else {
            if (data_chunk !== null) {
                //Process data chunk
                segmenter.processDataChunk(data_chunk, function (err) {
                    if (err) return final_callback(err, null);

                    if (typeof progress_callback === 'function') return progress_callback(read, total);
                });
            } else {
                //END
                segmenter.processDataEnd(function (err, chunklist) {
                    if (err) return final_callback(err, null);

                    return final_callback(null, chunklist);
                });
            }
        }
    });
}

function onFileSelectHandle(evt) {
    let file = document.getElementById('input-ts-file').files[0];

    if (file !== null) {
        console.log("Reading file!");

        //Show file name
        document.getElementById('input-ts-file-label').value = file.name;

        let final_callback = function (err, data) {
            if (err) {
                showError(err);
            } else {
                showResult(data);
            }
        };

        let progress_callback = function (read, total) {
            showResult('Processed: ' + read.toString() + '/' + total.toString());
        };

        chunklistGeneratorBrowser(file, 4, final_callback, progress_callback);
    }
}

function showError(msg) {
    showResult(msg);
}

//From: https://stackoverflow.com/questions/14438187/javascript-filereader-parsing-long-file-in-chunks
function parseFile(file, callback) {
    let fileSize = file.size;
    let chunkSize = 64 * 1024; // 64Kbytes
    let offset = 0;
    let chunkReaderBlock = null;

    let readEventHandler = function (evt) {
        if (evt.target.error !== null) {
            console.error("Read error: " + evt.target.error);
            return callback(evt.target.error, null);
        }

        offset += evt.target.result.byteLength;

        if (offset > 0) {
            let buff = Buffer.from(evt.target.result);

            callback(null, buff, offset, fileSize); // callback for handling read chunk
        }

        if (offset >= fileSize) {
            console.log("Done reading file");
            return callback(null, null, offset, fileSize);
        }

        //Next chunk
        chunkReaderBlock(offset, chunkSize, file);
    };

    chunkReaderBlock = function (_offset, length, _file) {
        let r = new FileReader();
        let blob = _file.slice(_offset, length + _offset);
        r.onload = readEventHandler;
        r.readAsArrayBuffer(blob);
    };

    // now let's start the read with the first block
    chunkReaderBlock(offset, chunkSize, file);
}

function showResult(data) {
    document.getElementById('result').innerHTML = '<pre><code>' + data + '</code></pre>';
}

//Start execution

document.getElementById('input-ts-file').addEventListener('change', onFileSelectHandle, false);

checkFileAPI();

}).call(this,require("buffer").Buffer)
},{"./chunklistGenerator.js":8,"buffer":4}],10:[function(require,module,exports){
const tspck = require('./tspacket.js');

"use strict";

class hls_chunk {
    constructor(index) {

        this.index = index;

        this.num_packets = 0;

        this.first_byte_pos = -1;
        this.last_byte_pos = -1;

        this.first_pcr = -1;
        this.last_pcr = -1;
        this.duration_s = 0;
    }

    addTSPacket(ts_packet) {
        this.addTSPacketInfo(ts_packet.getInfo());
    }

    addTSPacketInfo(ts_packet_info) {
        this.num_packets++;

        if (this.first_byte_pos < 0) this.first_byte_pos = ts_packet_info.first_byte_pos;else this.first_byte_pos = Math.min(this.first_byte_pos, ts_packet_info.first_byte_pos);

        this.last_byte_pos = Math.max(this.last_byte_pos, ts_packet_info.last_byte_pos);

        if (ts_packet_info.pcr >= 0) {
            if (this.first_pcr < 0) this.first_pcr = ts_packet_info.pcr;else this.first_pcr = Math.min(this.first_pcr, ts_packet_info.pcr);

            this.last_pcr = Math.max(this.last_pcr, ts_packet_info.pcr);
        }

        if (this.first_pcr > 0 && this.last_pcr > 0) {
            if (this.last_pcr >= this.first_pcr) {
                this.duration_s = Math.max(0, this.last_pcr - this.first_pcr);
            } else {
                //Detected possible PCR roll over
                console.log("Possible PCR rollover! first_pcr_current_segment: " + this.first_pcr + ". last_pcr_current_segment: " + this.last_pcr);
                this.duration_s = Math.max(0, tspck.tspacket.getMaxPcr() - this.last_pcr + this.first_pcr);
            }
        }
    }

    getIndex() {
        return this.index;
    }

    getNumTSPackets() {
        return this.num_packets;
    }

    getFirstBytePos() {
        return this.first_byte_pos;
    }

    getLastBytePos() {
        return this.last_byte_pos;
    }

    getDuration() {
        return this.duration_s;
    }
}

//Export class
module.exports.hls_chunk = hls_chunk;

},{"./tspacket.js":12}],11:[function(require,module,exports){

"use strict";

class hls_chunklist {
    constructor(media_file_url) {

        this.chunks_info = null;
        this.media_info = null;

        this.target_duration_s = -1;
        this.media_file_url = media_file_url;
    }

    setChunksInfo(chunks_info) {
        this.chunks_info = chunks_info;

        for (let i = 0; i < this.chunks_info.length; i++) {
            let chunk_info = this.chunks_info[i];

            this.target_duration_s = Math.max(this.target_duration_s, Math.ceil(chunk_info.getDuration()));
        }
    }

    setMediaIniInfo(media_info) {
        this.media_info = media_info;
    }

    toString() {
        if (this.chunks_info === null || this.media_info === null) return null;

        let ret = [];

        ret.push('#EXTM3U');
        ret.push('#EXT-X-TARGETDURATION:' + this.target_duration_s.toString());
        ret.push('#EXT-X-VERSION:6');
        ret.push('#EXT-X-MEDIA-SEQUENCE:0');
        ret.push('#EXT-X-PLAYLIST-TYPE:VOD');

        ret.push('#EXT-X-MAP:URI="' + this.media_file_url + '",BYTERANGE="' + (this.media_info.getLastBytePos() - this.media_info.getFirstBytePos()) + '@' + this.media_info.getFirstBytePos() + '"');

        for (let i = 0; i < this.chunks_info.length; i++) {
            let chunk_info = this.chunks_info[i];

            ret.push('#EXTINF:' + chunk_info.getDuration() + ',');
            ret.push('#EXT-X-BYTERANGE:' + (chunk_info.getLastBytePos() - chunk_info.getFirstBytePos()) + '@' + chunk_info.getFirstBytePos());
            ret.push(this.media_file_url);
        }
        ret.push('#EXT-X-ENDLIST');

        return ret.join('\n');
    }
}

//Export class
module.exports.hls_chunklist = hls_chunklist;

},{}],12:[function(require,module,exports){
(function (Buffer){
//Jordi Cenzano 2017

"use strict";

const TS_DEFAULT_PACKET_SIZE = 188;

const MAX_PCR_VALUE = 95443; //2^33 / 90000 (33 bits used by pcr with timebase of 90KHz)

// Constructor
class tspacket {

    constructor(packet_size, ts_packet_parser, ts_pat_packet_parser, ts_pmt_packet_parser) {

        this.packet_size = TS_DEFAULT_PACKET_SIZE;
        if (typeof packet_size === 'number') this.packet_size = packet_size;

        this.ts_packet_data = [];
        this.ts_packet_data_size = 0;

        this.ts_packet_buffer = null;

        this.packet_structure = null;

        //PAT parse
        this.packet_pat_structure = null;
        //PMT parse
        this.packet_pmt_structure = null;

        this.first_byte_pos = -1;
        this.last_byte_pos = -1;

        this.ts_packet_parser = ts_packet_parser;
        this.ts_pat_packet_parser = ts_pat_packet_parser;
        this.ts_pmt_packet_parser = ts_pmt_packet_parser;
    }

    addDataWithPos(first_bit_pos, buff, start, end, force_copy) {

        let start_internal = 0;
        if (typeof start === 'number') start_internal = start;

        let end_internal = buff.length;
        if (typeof end === 'number') end_internal = end;

        if (this.first_byte_pos < 0) this.first_byte_pos = first_bit_pos + start_internal;else this.first_byte_pos = Math.min(first_bit_pos + start_internal, this.first_byte_pos);

        this.last_byte_pos = Math.max(first_bit_pos + end_internal, this.last_byte_pos);

        return this.addData(buff, start, end, force_copy);
    }

    getFirstBytePos() {
        return this.first_byte_pos;
    }

    getLastBytePos() {
        return this.last_byte_pos;
    }

    addData(buff, start, end, force_copy) {
        let buff_start = 0;
        if (typeof start !== 'undefined') buff_start = start;

        let buff_end = buff.length;
        if (typeof end !== 'undefined') buff_end = end;

        let buff_force_copy = false;
        if (typeof force_copy === 'boolean' && force_copy === true) buff_force_copy = true;

        let buff_lenght = buff_end - buff_start;

        if (buff_lenght < 0) throw new Error("0 bytes can not be added to segment");

        if (buff_lenght > 0) {
            let new_buffer = null;
            if (buff_start !== 0 || buff_end !== buff.length) {
                if (buff_force_copy === false) {
                    new_buffer = Buffer.from(buff.buffer, start, buff_lenght);
                } else {
                    let tmp_buffer = Buffer.copy(buff.buffer, start, buff_lenght);

                    new_buffer = Buffer.from(tmp_buffer);
                }
            } else if (buff_lenght > 0) {
                if (buff_force_copy === false) new_buffer = buff;else new_buffer = Buffer.from(buff);
            }

            if (new_buffer !== null) {
                this.ts_packet_data.push(new_buffer);
                this.ts_packet_data_size += buff_lenght;
            }
        }
    }

    getFirstBytePos() {
        return this.first_byte_pos;
    }

    getLastBytePos() {
        return this.last_byte_pos;
    }

    getPcr() {
        let ret_ms = -1;

        this._parse();

        if (this.packet_structure !== null) {
            if ("adaptationField" in this.packet_structure && "PCRField" in this.packet_structure.adaptationField) {
                if (this.packet_structure.adaptationField.AdaptationFieldLength >= 7) {
                    let encoded_pcr = this.packet_structure.adaptationField.PCRField;

                    if ("Base32" in encoded_pcr && "Base33" in encoded_pcr && "Extension" in encoded_pcr) {
                        //console.log(encoded_pcr);

                        let base32 = encoded_pcr.Base32;
                        let base33 = encoded_pcr.Base33;

                        //Bitwise operators in javascript only works for < 32b numbers
                        // (base32 << 1) | (base33 & 0x1);
                        let pcr_base = base32 * 2 + (base33 & 0x1);
                        if (encoded_pcr.Extension > 0) {
                            //Use extension
                            let pcr = pcr_base * 300 + encoded_pcr.Extension;
                            ret_ms = pcr / (27 * 1000000);

                            console.log("PCR extension: " + encoded_pcr + ". Clk (27MHz): " + pcr + ". Time(ms): " + ret_ms);
                        } else {
                            ret_ms = pcr_base / 90000;
                        }
                    }
                }
            }
        }

        return ret_ms;
    }

    isPAT() {
        let ret = false;

        this._parse();

        if (this.packet_structure !== null) {
            if ("pid" in this.packet_structure && this.packet_structure.pid === 0) ret = true;
        }

        return ret;
    }

    isID(id) {
        let ret = false;

        this._parse();

        if (this.packet_structure !== null) {
            if ("pid" in this.packet_structure && this.packet_structure.pid === id) ret = true;
        }

        return ret;
    }

    getESInfo() {
        let ret = null;

        this._parsePMT();

        if (this.packet_pmt_structure !== null) {
            if ("payload" in this.packet_pmt_structure && "elementaryStreamsInfo" in this.packet_pmt_structure.payload) ret = this.packet_pmt_structure.payload.elementaryStreamsInfo;
        }

        return ret;
    }

    getPMTsIDs() {
        let ret = null;

        if (this.isPAT()) {
            this._parsePAT();

            if (this.packet_pat_structure !== null) {
                if ("payload" in this.packet_pat_structure && "pmtsData" in this.packet_pat_structure.payload) ret = this.packet_pat_structure.payload.pmtsData;
            }
        }

        return ret;
    }

    isRandomAccess(pid) {
        let ret = false;

        this._parse();

        if (this.packet_structure !== null) {
            if ("adaptationField" in this.packet_structure && "PCRField" in this.packet_structure.adaptationField) {
                if (this.packet_structure.adaptationField.AdaptationFieldLength >= 1) {
                    if (this.packet_structure.adaptationField.RandomAccessIndicator > 0 && this.packet_structure.pid === pid) ret = true;
                }
            }
        }

        return ret;
    }

    getBuffer() {
        if (this.ts_packet_buffer === null) {
            if (this.ts_packet_data.length > 1) {
                //console.log("Number of buffer to concat: " + this.ts_packet_data.length);
                this.ts_packet_buffer = Buffer.concat(this.ts_packet_data);
            } else if (this.ts_packet_data.length === 1) {
                this.ts_packet_buffer = this.ts_packet_data[0];
            }
        }

        return this.ts_packet_buffer;
    }

    getInfo() {
        return {
            first_byte_pos: this.getFirstBytePos(),
            last_byte_pos: this.getLastBytePos(),
            pcr: this.getPcr()
        };
    }

    clone() {
        let ret = new tspacket(this.packet_size, this.ts_packet_parser);

        let buff_src = this.getBuffer();
        ret.addData(buff_src, 0, buff_src.length, true);

        return ret;
    }

    _parse() {
        //Only process complete packets (just in case)
        if (this.ts_packet_data_size >= this.packet_size && this.packet_structure === null) {
            this.getBuffer();

            this.packet_structure = this.ts_packet_parser.parse(this.ts_packet_buffer);
        }
    }

    _parsePAT() {
        //Only process complete packets (just in case)
        if (this.ts_packet_data_size >= this.packet_size && this.packet_pat_structure === null) {
            this.getBuffer();

            this.packet_pat_structure = this.ts_pat_packet_parser.parse(this.ts_packet_buffer);
        }
    }

    _parsePMT() {
        //Only process complete packets (just in case)
        if (this.ts_packet_data_size >= this.packet_size && this.packet_pmt_structure === null) {
            this.getBuffer();

            this.packet_pmt_structure = this.ts_pmt_packet_parser.parse(this.ts_packet_buffer);
        }
    }

    static getMaxPcr() {
        return MAX_PCR_VALUE;
    }

    //According to ISO/IEC 13818-1:2007 (E)
    static isStreamTypeVideo(stream_type) {
        let ret = false;

        if (stream_type === 0x01) ret = true; //ISO/IEC 11172-2 Video

        if (stream_type === 0x02) ret = true; //ITU-T Rec. H.262 | ISO/IEC 13818-2 Video or ISO/IEC 11172-2 constrained parameter video stream

        if (stream_type === 0x1B) ret = true; //AVC video stream as defined in ITU-T Rec. H.264 | ISO/IEC 14496-10 Video

        return ret;
    }

}

//Export class
module.exports.tspacket = tspacket;

}).call(this,require("buffer").Buffer)
},{"buffer":4}],13:[function(require,module,exports){
//Jordi Cenzano 2017
const binparser = require('binary-parser').Parser;

"use strict";

// Constructor
class tspacketParser {

    constructor() {

        //TODO: A lot of repeated code, it can be optimized

        //Utils
        this.stop_parse = new binparser();

        this.skip_0 = new binparser().endianess('big').skip(function () {
            return 0;
        });

        //PCR
        this.ts_packet_adaptation_field_pcrs = new binparser().endianess('big').uint32('Base32').bit1('Base33').bit6('Reserved').bit9('Extension');

        //Adaptation field
        this.ts_packet_adaptation_field = new binparser().endianess('big').uint8('AdaptationFieldLength').bit1('DiscontinuityIndicator').bit1('RandomAccessIndicator').bit1('ElementaryStreamPriorityIndicator').bit1('PCRFlag').bit1('OPCRFlag').bit1('SplicingPointFlag').bit1('TransportPrivateDataFlag').bit1('AdaptationFieldExtensionFlag').choice('PCRField', {
            tag: 'PCRFlag',
            defaultChoice: this.stop_parse,
            choices: {
                1: this.ts_packet_adaptation_field_pcrs
            }
        });

        //General TS packet
        this.ts_packet_parser = new binparser().endianess('big').uint8('syncByte').bit1('transportErrorIndicator').bit1('payloadUnitStartIndicator').bit1('transportPriority').bit13('pid').bit2('transportScramblingControl').bit2('adaptationFieldControl').bit4('continuityCounter').choice('adaptationField', {
            tag: 'adaptationFieldControl',
            defaultChoice: this.stop_parse,
            choices: {
                2: this.ts_packet_adaptation_field,
                3: this.ts_packet_adaptation_field
            }
        });

        //PAT table component
        this.ts_packet_payload_table_pat_component = new binparser().endianess('big').uint16('programNumber').bit3('reservedBits').bit13('pmtID');

        //PAT table
        this.ts_packet_payload_table_pat = new binparser().endianess('big').uint8('tableID').bit1('sectionSyntaxIndicator').bit1('privateBit').bit2('reservedBits1').bit2('unusedBits').bit10('sectionLength').uint16('tableIDExtension').bit2('reservedBits2').bit5('versionNum').bit1('currentNext').uint8('sectionNumber').uint8('lastSectionNumber').array('pmtsData', {
            type: this.ts_packet_payload_table_pat_component,
            length: function () {
                return (this.sectionLength - (5 + 4)) / 4;
            }
        }).uint32('CRC');

        //Pointer before payload
        this.ts_packet_pointer = new binparser().endianess('big').uint8('length').skip(function () {
            return this.length;
        });

        //PAT packet
        this.ts_packet_PAT_parser = new binparser().endianess('big').uint8('syncByte').bit1('transportErrorIndicator').bit1('payloadUnitStartIndicator').bit1('transportPriority').bit13('pid', { assert: 0 }).bit2('transportScramblingControl').bit2('adaptationFieldControl').bit4('continuityCounter').choice('adaptationField', {
            tag: 'adaptationFieldControl',
            defaultChoice: this.stop_parse,
            choices: {
                1: this.skip_0,
                2: this.ts_packet_adaptation_field,
                3: this.ts_packet_adaptation_field
            }
        }).choice('pointer', {
            tag: 'payloadUnitStartIndicator',
            defaultChoice: this.stop_parse,
            choices: {
                0: this.skip_0,
                1: this.ts_packet_pointer
            }
        }).choice('payload', {
            tag: 'adaptationFieldControl',
            defaultChoice: this.stop_parse,
            choices: {
                1: this.ts_packet_payload_table_pat,
                3: this.ts_packet_payload_table_pat
            }
        });

        //PMT table ES component
        this.ts_packet_payload_table_pmt_es_component = new binparser().endianess('big').uint8('streamType').bit3('reservedBits').bit13('elementaryPID').bit4('reservedBits1').bit2('unusedBits').bit10('elementaryInfoLength').skip(function () {
            return this.elementaryInfoLength;
        });

        //PMT table
        this.ts_packet_payload_table_pmt = new binparser().endianess('big').uint8('tableID').bit1('sectionSyntaxIndicator').bit1('privateBit').bit2('reservedBits1').bit2('unusedBits').bit10('sectionLength').uint16('tableIDExtension').bit2('reservedBits2').bit5('versionNum').bit1('currentNext').uint8('sectionNumber').uint8('lastSectionNumber').bit3('reservedBits').bit13('pcrPID').bit4('reservedBits1').bit2('reservedBits2').bit10('programInfoLength').skip(function () {
            return this.programInfoLength;
        }).array('elementaryStreamsInfo', {
            type: this.ts_packet_payload_table_pmt_es_component,
            lengthInBytes: function () {
                return this.sectionLength - (9 + this.programInfoLength + 4);
            }
        }).uint32('CRC');

        //PMT parser
        this.ts_packet_PMT_parser = new binparser().endianess('big').uint8('syncByte').bit1('transportErrorIndicator').bit1('payloadUnitStartIndicator').bit1('transportPriority').bit13('pid').bit2('transportScramblingControl').bit2('adaptationFieldControl').bit4('continuityCounter').choice('adaptationField', {
            tag: 'adaptationFieldControl',
            defaultChoice: this.stop_parse,
            choices: {
                1: this.skip_0,
                2: this.ts_packet_adaptation_field,
                3: this.ts_packet_adaptation_field
            }
        }).choice('pointer', {
            tag: 'payloadUnitStartIndicator',
            defaultChoice: this.stop_parse,
            choices: {
                0: this.skip_0,
                1: this.ts_packet_pointer
            }
        }).choice('payload', {
            tag: 'adaptationFieldControl',
            defaultChoice: this.stop_parse,
            choices: {
                1: this.ts_packet_payload_table_pmt,
                3: this.ts_packet_payload_table_pmt
            }
        });
    }

    getPacketParser() {
        return this.ts_packet_parser;
    }

    getPATPacketParser() {
        return this.ts_packet_PAT_parser;
    }

    getPMTPacketParser() {
        return this.ts_packet_PMT_parser;
    }
}

//Export class
module.exports.tspacketParser = tspacketParser;

},{"binary-parser":2}]},{},[9]);
