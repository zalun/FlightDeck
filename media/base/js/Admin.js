window.addEvent('domready', function(e){
    var setMsg = function(msg){
        var elem = $('package_msg');
        elem.set('html', msg);
        setTimeout(function(){
            elem.set('html','');
        },2000);
    }
    $('btn_find_package').addEvent('click', function(e){
        var r = new Request({
            url: admin_settings.get_package_url,
            onSuccess: function(p){
                $('package_item').set('html',p);               
            },
            onFailure: function(err){
                console.log(err);
                setMsg(err.status + " " + err.statusText);                
            }
        });        
        r.get('package_id='+ $('txt_package_id').value);
       
    });
    
    var updatePackage = function(elem, field, callback){
        var id = elem.getParent('.package').getElement('.package_id').value,
            enabled = elem.getParent().hasClass('pressed'),
            r = new Request({
                url: admin_settings.update_package_url,
                method: 'post',              
                onSuccess: function(p){
                     setMsg("updated");
                     elem.getParent().toggleClass('pressed');
                     if (callback) callback();
                },
                onFailure: function(err){
                    if(err.status == 404){
                        $('package_item').set('html', '');
                    }
                    setMsg(err.status + " " + err.statusText);
                }
            });
        r.send('package_id='+id+'&'+field+'='+!enabled);
    };
    
    $('package_item').addEvent('click:relay(.UI_Package_Featured a)', function(e){
        e.stop();        
        updatePackage(this, 'featured')
    });
    $('package_item').addEvent('click:relay(.UI_Package_Example a)', function(e){
        e.stop();
        updatePackage(this, 'example')
    });
});