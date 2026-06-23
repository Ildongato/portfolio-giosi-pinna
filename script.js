document.addEventListener('DOMContentLoaded', () => {
  initArtImage();
  initLightboxDetailZoom();
});

function initArtImage() {
  const artImage = document.getElementById('artImage');
  if (!artImage) return;

  const dataSrc = artImage.getAttribute('data-src');
  if (dataSrc) artImage.src = dataSrc;

  artImage.addEventListener('load', () => {
    artImage.classList.add('loaded');
  });
}

function initLightboxDetailZoom() {
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const lightboxContents = document.querySelectorAll('.lightbox-content');
  if (!lightboxContents.length) return;

  lightboxContents.forEach((content) => {
    const image = content.querySelector('.lightbox-img');
    const frame = content.querySelector('.lightbox-zoom-frame');
    if (!image || !frame) return;

    const lightbox = content.closest('.lightbox');
    let zoomPointer = null;
    let lightboxWasOpen = false;
    const clamp = (value) => Math.max(0, Math.min(100, value));
    const isFinePointerEvent = (event) => {
      return finePointer.matches && event.pointerType !== 'touch' && Boolean(image.currentSrc || image.src);
    };

    const setZoomPosition = (event) => {
      const rect = frame.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const x = clamp(((event.clientX - rect.left) / rect.width) * 100);
      const y = clamp(((event.clientY - rect.top) / rect.height) * 100);

      image.style.setProperty('--zoom-x', x.toFixed(2) + '%');
      image.style.setProperty('--zoom-y', y.toFixed(2) + '%');
    };

    const resetZoom = () => {
      zoomPointer = null;
      content.classList.remove('is-detail-zooming');
      image.style.removeProperty('--zoom-x');
      image.style.removeProperty('--zoom-y');
    };

    const toggleZoom = (event) => {
      if (content.classList.contains('is-detail-zooming')) {
        resetZoom();
        return;
      }

      setZoomPosition(event);
      content.classList.add('is-detail-zooming');
    };

    const beginZoomPointer = (event) => {
      if (!isFinePointerEvent(event) || event.button !== 0) return;

      zoomPointer = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        moved: false,
      };

      event.preventDefault();
      event.stopPropagation();
      frame.setPointerCapture?.(event.pointerId);

      if (content.classList.contains('is-detail-zooming')) {
        setZoomPosition(event);
      }
    };

    const moveZoomPointer = (event) => {
      if (content.classList.contains('is-detail-zooming') && isFinePointerEvent(event)) {
        setZoomPosition(event);
      }

      if (!zoomPointer || zoomPointer.id !== event.pointerId) return;

      const deltaX = event.clientX - zoomPointer.x;
      const deltaY = event.clientY - zoomPointer.y;
      if (Math.hypot(deltaX, deltaY) > 6) {
        zoomPointer.moved = true;
      }

      event.preventDefault();
      event.stopPropagation();
    };

    const endZoomPointer = (event) => {
      if (!zoomPointer || zoomPointer.id !== event.pointerId) return;

      const shouldToggle = !zoomPointer.moved;
      zoomPointer = null;

      event.preventDefault();
      event.stopPropagation();
      frame.releasePointerCapture?.(event.pointerId);

      if (shouldToggle) {
        toggleZoom(event);
      }
    };

    const cancelZoomPointer = (event) => {
      if (zoomPointer && zoomPointer.id === event.pointerId) {
        zoomPointer = null;
      }
    };

    const syncAvailability = () => {
      content.classList.toggle('is-detail-zoomable', finePointer.matches);
      if (!finePointer.matches) resetZoom();
    };

    frame.addEventListener('pointerdown', beginZoomPointer, true);
    frame.addEventListener('pointermove', moveZoomPointer, true);
    frame.addEventListener('pointerup', endZoomPointer, true);
    frame.addEventListener('pointercancel', cancelZoomPointer, true);
    frame.addEventListener('click', (event) => {
      if (!finePointer.matches) return;
      event.preventDefault();
      event.stopPropagation();
    }, true);

    content.addEventListener('pointermove', (event) => {
      if (!isFinePointerEvent(event) || !content.classList.contains('is-detail-zooming')) return;
      setZoomPosition(event);
    }, true);

    image.addEventListener('load', resetZoom);

    if (lightbox && 'MutationObserver' in window) {
      const observer = new MutationObserver(() => {
        const isOpen = lightbox.classList.contains('show');
        if (!isOpen || !lightboxWasOpen) {
          resetZoom();
        }
        lightboxWasOpen = isOpen;
      });
      observer.observe(lightbox, { attributes: true, attributeFilter: ['class'] });
    }

    syncAvailability();
    finePointer.addEventListener?.('change', syncAvailability);
  });
}
