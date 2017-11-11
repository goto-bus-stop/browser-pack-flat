/**
 * Helper used in the output bundle to resolve dependency cycles.
 * This helper wraps a module factory and lazily executes it.
 * Imports of a circular module will call the factory returned by this function.
 */
module.exports = function createModuleFactory (factory) {
  var module
  return function () {
    if (!module) {
      module = { exports: {} }
      factory(module, module.exports)
    }
    return module.exports
  }
}
