function highlight() {
  $$('pre code').set('class', 'js');
  $$('pre code').set('id', 'jsCode');
  $$('pre code').light({ altLines: 'hover' });
  }

window.addEvent('domready', function(){
  highlight();
});
