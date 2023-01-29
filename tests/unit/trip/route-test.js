import { module, test } from 'qunit';
import { setupTest } from 'picasa-ember/tests/helpers';

module('Unit | Route | trip', function (hooks) {
  setupTest(hooks);

  test('it exists', function (assert) {
    let route = this.owner.lookup('route:trip');
    assert.ok(route);
  });
});
