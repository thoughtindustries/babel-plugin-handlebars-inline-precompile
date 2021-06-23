"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _resolveCwd = _interopRequireDefault(require("resolve-cwd"));

var _helperModuleImports = require("@babel/helper-module-imports");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Use local handlebars (if installed as a peer) rather than the version that
// came with this plugin. Allows a newer handlebars to be used without needing
// to upgrade this package.
var Handlebars = require('ti-ember-templates-loader/ember-template-compiler');

function _default(_ref) {
  var t = _ref.types;
  var IMPORT_NAME = 'handlebars-inline-precompile';
  var IMPORT_PROP = '_handlebarsImportSpecifier';

  function isReferenceToImport(node, file) {
    return t.isIdentifier(node, {
      name: file[IMPORT_PROP] && file[IMPORT_PROP].input
    });
  } // Precompile template and replace node.


  function compile(path, template) {
    var precompiled = Handlebars.precompile(template);
    path.replaceWithSourceString("Ember.Handlebars.template(".concat(precompiled, ")"));
  }

  return {
    visitor: {
      /**
       * Find the import declaration for `hbs`.
       */
      ImportDeclaration: function ImportDeclaration(path, file) {
        var node = path.node,
            scope = path.scope; // Filter out anything other than the `hbs` module.

        if (!t.isLiteral(node.source, {
          value: IMPORT_NAME
        })) {
          return;
        }

        var first = node.specifiers && node.specifiers[0]; // Throw an error if using anything other than the default import.

        if (!t.isImportDefaultSpecifier(first)) {
          var usedImportStatement = file.file.code.slice(node.start, node.end);
          throw path.buildCodeFrameError("Only `import hbs from '".concat(IMPORT_NAME, "'` is supported. You used: `").concat(usedImportStatement, "`"));
        } // const importPath = addDefault(path, 'handlebars/runtime', { nameHint: scope.generateUid('Handlebars') });


        path.remove(); // Store the import name to lookup references elsewhere.

        file[IMPORT_PROP] = {
          input: first.local.name
        };
      },

      /**
       * Look for places where `hbs` is called normally.
       */
      CallExpression: function CallExpression(path, file) {
        var node = path.node; // filter out anything other than `hbs`.

        if (!isReferenceToImport(node.callee, file)) {
          return;
        }

        var template = node.arguments.length > 0 && node.arguments[0].value; // `hbs` should be called as `hbs('template')`.

        if (node.arguments.length !== 1 || typeof template !== 'string') {
          throw path.buildCodeFrameError("".concat(node.callee.name, " should be invoked with a single argument: the template string"));
        }

        compile(path, template);
      },

      /**
       * Look for places where `hbs` is called as a tagged template.
       */
      TaggedTemplateExpression: function TaggedTemplateExpression(path, file) {
        var node = path.node; // filter out anything other than `hbs`.

        if (!isReferenceToImport(node.tag, file)) {
          return;
        } // hbs`${template}` is not supported.


        if (node.quasi.expressions.length) {
          throw path.buildCodeFrameError('placeholders inside a tagged template string are not supported');
        }

        var template = node.quasi.quasis.map(function (quasi) {
          return quasi.value.cooked;
        }).join('');
        compile(path, template);
      }
    }
  };
}