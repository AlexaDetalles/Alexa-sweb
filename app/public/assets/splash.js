// Loader de la portada: se muestra una vez por visita. Se decide antes de pintar para que no haya parpadeo.
(function(){try{if(sessionStorage.getItem('alexa_splash')){document.documentElement.classList.add('splash-visto');}else{sessionStorage.setItem('alexa_splash','1');}}catch(e){}})();
