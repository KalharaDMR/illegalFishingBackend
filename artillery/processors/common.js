/**
 * Used by post-api-auth-signup.yml — unique email per VU so signup load tests do not hit "email exists".
 */
function uniqueSignupEmail(context, events, done) {
  context.vars.signupEmail = `perf-${Date.now()}-${Math.random().toString(36).slice(2, 10)}@perf.test`;
  return done();
}

module.exports = { uniqueSignupEmail };
