// Helper to expose a module.
function expose (m) {
  // A locally exposed module
  if (expose.m.hasOwnProperty(m)) {
    return expose.m[m]
  }
  // A module exposed on a previous chunk
  if (typeof expose.r === 'function') {
    return expose.r(m)
  }
  // A module exposed on a later chunk
  if (typeof require === 'function' && require !== expose) {
    return require(m)
  }
}
