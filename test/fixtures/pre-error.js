module.exports = function(target, done) {
  setTimeout(function() {
    done((new Error('upgrade failed')).toString())
  }, 500)
}
