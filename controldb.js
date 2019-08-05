'use strict';

// Shortcuts to DOM Elements.
var titleInput = document.getElementById('new-post-title');
var messageInput = document.getElementById('new-post-message');
var signInButton = document.getElementById('sign-in-button');
var signOutButton = document.getElementById('sign-out-button');
var addPostButton = document.getElementById('add-post-btn');
var recentPostsSection = document.getElementById('recent-posts-list');
var listeningFirebaseRefs = [];

// Esta variable es la que tiene que cambiar de acuerdo al partido elegido.
// Para ejemplo voy a usar '123456789'
var temaId = 123456789;
var currentUID;
var userName;
var userId
/**
 * Nuevo post en DB.
 */

function writeNewPost(uid, username, title, body) {
  // A post entry.
  var postData = {
    author: username,
    uid: uid,
    body: body,
    title: title,
  };

  // Obtengo una nueva clave para guardar junto al post.
  var newPostKey = firebase.database().ref().child('posts').push().key;

  // Guardo los datos obtenidos en la base de datos. RUTA: '/posts/123456789/newPostKey'
  var updates = {};
  updates['/posts/' + temaId + '/' + newPostKey] = postData;

  return firebase.database().ref().update(updates);
}
/**
 * Nuevo comentario en DB.
 */
function createNewComment(postId, username, text) {
  //Guardo los comentarios en otra tabla que no sea la misma de /post.
  firebase.database().ref('postscomments/' + temaId + '/' + postId).push({
    text: text,
    author: username,
    postId: postId
  });
}

/**
 * Plantilla HTML para agregar nuevo post
 */
function createPostElement(postId, title, text, author) {

  return `
          <div id="${postId}" class="caja-post mt-2 p-2 bg-light rounded">
            <h4 class="caja-post-titulo">${title}</h4>
            <p class="caja-post-comentario mb-2">${text}</p>
            <div class="d-flex justify-content-between">
                <h6>Por ${author}</h6>
                <h6 data-toggle="collapse" data-target="#post${postId}"><u>Comentarios</u></h6>
            </div>

            <!-- ACORDEON DE COMENTARIOS. -->
            <div id="post${postId}" class="collapse" data-parent="#recent-posts-list">
                <div class="form-group mt-1 form-comment">

                    <input type="text" class="form-control" id="cp${postId}" placeholder="Comentar...">
                    <button type="button" class="btn mx-auto comment-btn w-100 mt-2">Agregar
                        comentario</button>
                </div>
                <!-- Contenido de comentarios -->
                <div id="ctn${postId}">
                </div>
            </div>
        </div>
        `
}
/**
 * Plantilla HTML para agregar nuevo comentario.
 */
function createCommentElement(text, author) {

  return `
          <div class="caja-comentario px-1">
            <hr>
            <h6 class="tx-p cm-autor">${author} dijo:</h6>
            <p class="pl-1 comentario">${text}</p>
          </div>
        `
}

/**
 * Inicio los listeners, y traigo los temas/comentarios ya creados de la DB.
 */
function startDatabaseQueries() {
  // Los temas se traen desde 'post/$iDdelCorrespondientePartido. EJ: 'post/123456789'.
  const lastPostMatchRef = firebase.database().ref('posts/' + temaId).limitToLast(100);
  // Los comentarios se traen desde 'comments/$iDdelCorrespondientePartido. EJ: 'postscomments/123456789'.
  const commentsPostRef = firebase.database().ref('postscomments/' + temaId).limitToLast(100);

  // Traigo los post.
  var fetchPosts = function (postsRef) {
    // Al iniciar el foro, trae todos los temas ($post), cuando se añade un nuevo post, gracias al listener que dejo al 
    // finalizar la funcion, lo agrega también sin tener que reiniciar.
    postsRef.on('child_added', function (post) {
      // Data es un Objeto que contiene:
      // 'post.key' = id del post.
      // 'post.val().title' = titulo del post.
      // 'post.val().body' = cuerpo del post.
      // 'post.val().author' = creador del post.
      $('#recent-posts-list').prepend(
        // Paso esos datos como parametros para crear y añadir al html el post.
        createPostElement(post.key, post.val().title, post.val().body, post.val().author)
      );

    });

  };

  // Traigo los comentarios.
  var fetchComments = function (commentsR) {

    //Solo al iniciar, y despues de haber traido los temas, trae los comentarios.
    commentsR.on('child_added', function (data) {
      var comentarios = data.val();
      // Cada comentario está compuesto por 3 atributos:
      for (let com in comentarios) {
        // comentarios[com].postId = id del post al que pertenece.
        // comentarios[com].text = contenido del post al que pertenece.
        // comentarios[com].author = creador del post al que pertenece.

        // Con 'ctn' + el id, busco en el html el post al que pertenece y lo añado.
        $('#ctn' + comentarios[com].postId).prepend(createCommentElement(comentarios[com].text, comentarios[com].author));

      }
    });
    //Cada vez que se agrega un comentario, ejecuta esta funciòn.
    commentsR.on('child_changed', function (data) {

      var comentarios = data.val();
      // Borro todos los comentarios anteriores, de otra manera se duplican.
      for (let com in comentarios) {
        $('#ctn' + comentarios[com].postId).html('');
      }

      // Cada comentario está compuesto por 3 atributos:
      for (let com in comentarios) {
        // comentarios[com].postId = id del post al que pertenece.
        // comentarios[com].text = contenido del post al que pertenece.
        // comentarios[com].author = creador del post al que pertenece.

        // Con 'ctn' + el id, busco en el html el post al que pertenece y lo añado.
        $('#ctn' + comentarios[com].postId).prepend(createCommentElement(comentarios[com].text, comentarios[com].author));

      }
    });
  };

  // Ejecuto las funciones para traer post/comentarios.
  fetchPosts(lastPostMatchRef);
  fetchComments(commentsPostRef);


  // Seguimos escuchando por algun comentario o tema nuevo.
  listeningFirebaseRefs.push(lastPostMatchRef);
  listeningFirebaseRefs.push(commentsPostRef);
}

/**
 * Escribo los datos de usuario en la base de datos.
 */
function writeUserDataOnDB(userId, name, email) {
  firebase.database().ref('users/' + userId).set({
    username: name,
    email: email,
  });
}

/**
 * Limpio los foros de los temas que añadi de la base de datos.
 * Apago los listeners de post/comentarios..
 */
function cleanupUi() {
  // Remove all previously displayed posts.
  recentPostsSection.innerHTML = '';

  // Stop all currently listening Firebase listeners.
  listeningFirebaseRefs.forEach(function (ref) {
    ref.off();
  });
  listeningFirebaseRefs = [];
}

/**
 * Se dispara siempre que hay un cambio de el estado de la sesion. (Inicio o cierre.) 
 */
function onAuthStateChanged(user) {
  // We ignore token refresh events.
  if (user && currentUID === user.uid) {
    return;
  }
  cleanupUi();

  if (user) {
    // Escondo el boton de inicio de sesion.
    $(signInButton).addClass('hide');
    // Muestro el botón de cerrar sesión.
    $(signOutButton).removeClass('hide');
    //Muestro el formulario.
    $('#crear-post').removeClass('hide');
    // Igualo datos para añadir post y comentarios.
    userName = user.displayName;
    userId = firebase.auth().currentUser.uid;
    // id para crear post y comentario (autor).
    currentUID = user.uid;
    // Guardo los datos del usuario actual.
    writeUserDataOnDB(user.uid, user.displayName, user.email);
    // Inicio la llamada a la base de datos (trigo post/comentarios.)
    startDatabaseQueries();
  } else {
    // Set currentUID to null.
    currentUID = null;
  }
}

/**
 * Detecto el boton añadir nuevo comentario.
 */
$(document).on("click", ".comment-btn", function () {
  // Tomo el id del post en el que estoy comentando
  var postId = $(this).parents('.caja-post').attr('id');
  // Tomo el contenido del comentario
  var commentInput = document.getElementById('cp' + postId);
  // Si esta vacio , cancelo.
  if (commentInput.value === '') {
    return;
  } else {
    // Guardo el comentairo en la base de datos.
    createNewComment(postId, firebase.auth().currentUser.displayName, commentInput.value);
    // Borro el contenido del input.
    commentInput.value = '';
  }
});
/**
 * Otros eventos.
 */
window.addEventListener('load', function () {
  // Boton log-in
  signInButton.addEventListener('click', function () {
    var provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider);
  });
  // Boton log-out
  signOutButton.addEventListener('click', function () {
    firebase.auth().signOut();
    location.reload();
  });
  // Mantengo un seguimiendo del estado de la sesion, se activa cuando cambia
  //(Inicio o cierre.)
  firebase.auth().onAuthStateChanged(onAuthStateChanged);

  // Guardo el post en la base de datos, con el boton 'agregar'.
  addPostButton.addEventListener('click', function (e) {
    e.preventDefault();
    let title = titleInput.value;
    let text = messageInput.value;

    if (text && title) {
      writeNewPost(userId, userName, title, text);
      messageInput.value = '';
      titleInput.value = '';
    }
  });

});