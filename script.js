document.addEventListener('DOMContentLoaded', () => {
  // Optioneel: fade-in / 'loaded' class voor een specifieke afbeelding.
  // Gebruik in HTML: <img id="artImage" data-src="images/..." alt="...">
  const artImage = document.getElementById('artImage');
  if (!artImage) return;

  // Als er een data-src staat, gebruiken we die om lazy-ish te laden.
  const dataSrc = artImage.getAttribute('data-src');
  if (dataSrc) artImage.src = dataSrc;

  artImage.addEventListener('load', () => {
    artImage.classList.add('loaded');
  });
});
