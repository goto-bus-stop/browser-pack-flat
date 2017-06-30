module.exports = Binding

function Binding (name, definition) {
  this.name = name
  this.definition = definition
  this.references = new Set()

  if (definition) this.add(definition)
}

Binding.prototype.add = function (node) {
  this.references.add(node)
  return this
}

Binding.prototype.getReferences = function () {
  var arr = []
  this.references.forEach(function (ref) { arr.push(ref) })
  return arr
}

Binding.prototype.rename = function (newName) {
  this.references.forEach(function (node) {
    if (node.parent.type === 'Property' && node.parent.shorthand) {
      node.edit.update(node.name + ': ' + newName)
    } else {
      node.edit.update(newName)
    }
  })
  return this
}
