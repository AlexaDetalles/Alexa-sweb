// Loader de la portada: se muestra una vez por visita y se decide antes de pintar (sin parpadeo). Un toque lo salta.
(function(){var h=document.documentElement;try{if(sessionStorage.getItem('alexa_splash')){h.classList.add('splash-visto');}else{sessionStorage.setItem('alexa_splash','1');}}catch(e){}
document.addEventListener('pointerdown',function(e){if(e.target.closest&&e.target.closest('.loader'))h.classList.add('splash-visto');},{passive:true});})();
