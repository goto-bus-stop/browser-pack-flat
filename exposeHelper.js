// Helper to expose a module.
function expose (m, jumped) {
  // A locally exposed module
  if (expose.m.hasOwnProperty(m)) {
    return expose.m[m]
  }
  // A module exposed on a later chunk
  if (typeof require === 'function' && !jumped) {
    return require(m, 1)
  }
  // A module exposed on a previous chunk
  if (typeof expose.r === 'function') {
    return expose.r(m, 1)
  }
}
