var yo = require('yo-yo')

module.exports = function render (props) {
  return yo`
    <body>
      <div>${props.counter}</div>
      <button onclick=${onclick}>
        +1
      </button>
    </body>
  `

  function onclick () {
    props.increment()
  }
}
