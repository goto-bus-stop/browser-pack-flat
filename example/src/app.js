var yo = require('yo-yo')
var view = require('./view')
var counter = 0

function render () {
  yo.update(document.body, view({
    counter: counter,
    increment: function () {
      counter++
      render()
    }
  }))
}

render()
