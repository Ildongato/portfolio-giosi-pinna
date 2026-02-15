document.addEventListener('DOMContentLoaded', () => {
  const artImage = document.getElementById('artImage');

  // Stel de afbeelding-URL in
  artImage.src = 'https://i.imgur.com/gRPoD5n.jpeg';

  // Voeg de 'loaded' klasse toe zodra de afbeelding is geladen
  artImage.onload = () => {
    artImage.classList.add('loaded');
  };
});

