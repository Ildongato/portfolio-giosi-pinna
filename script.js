document.addEventListener('DOMContentLoaded', () => {
  initArtImage();
  initLightboxDetailZoom();
  initLightboxTouchZoom();
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

function initLightboxTouchZoom() {
  const lightboxContents = document.querySelectorAll('.lightbox-content');
  if (!lightboxContents.length) return;

  lightboxContents.forEach((content) => {
    const image = content.querySelector('.lightbox-img');
    const frame = content.querySelector('.lightbox-zoom-frame');
    if (!image || !frame) return;

    const lightbox = content.closest('.lightbox');
    const minScale = 1;
    const maxScale = 4;
    let scale = 1;
    let translateX = 0;
    let translateY = 0;
    let startScale = 1;
    let startTranslateX = 0;
    let startTranslateY = 0;
    let startDistance = 0;
    let pinchContentX = 0;
    let pinchContentY = 0;
    let panStartX = 0;
    let panStartY = 0;
    let isPinching = false;
    let isPanning = false;

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    const getTouchCenter = (touches) => {
      const first = touches[0];
      const second = touches[1] || touches[0];
      return {
        x: (first.clientX + second.clientX) / 2,
        y: (first.clientY + second.clientY) / 2,
      };
    };

    const getTouchDistance = (touches) => {
      if (touches.length < 2) return 0;
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
    };

    const getCenterOffset = (point) => {
      const rect = frame.getBoundingClientRect();
      return {
        x: point.x - (rect.left + rect.width / 2),
        y: point.y - (rect.top + rect.height / 2),
      };
    };

    const clampTranslate = () => {
      const rect = frame.getBoundingClientRect();
      const maxX = Math.max(0, (rect.width * (scale - 1)) / 2);
      const maxY = Math.max(0, (rect.height * (scale - 1)) / 2);

      translateX = clamp(translateX, -maxX, maxX);
      translateY = clamp(translateY, -maxY, maxY);
    };

    const applyTransform = () => {
      clampTranslate();
      const isZoomed = scale > 1.01;

      content.classList.toggle('is-touch-zoomed', isZoomed);
      image.style.transformOrigin = 'center center';

      if (isZoomed) {
        image.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`;
      } else {
        image.style.removeProperty('transform');
        image.style.removeProperty('transform-origin');
      }
    };

    const resetTouchZoom = () => {
      scale = 1;
      translateX = 0;
      translateY = 0;
      isPinching = false;
      isPanning = false;
      content.classList.remove('is-touch-zooming', 'is-touch-zoomed');
      image.style.removeProperty('transform');
      image.style.removeProperty('transform-origin');
    };

    const settleTouchZoom = () => {
      content.classList.remove('is-touch-zooming');
      if (scale < 1.04) {
        resetTouchZoom();
      } else {
        applyTransform();
      }
    };

    frame.addEventListener('touchstart', (event) => {
      if (!lightbox?.classList.contains('show')) return;
      if (!image.currentSrc && !image.src) return;

      if (event.touches.length === 2) {
        const center = getTouchCenter(event.touches);
        const centerOffset = getCenterOffset(center);

        startScale = scale;
        startTranslateX = translateX;
        startTranslateY = translateY;
        startDistance = getTouchDistance(event.touches);
        pinchContentX = (centerOffset.x - startTranslateX) / startScale;
        pinchContentY = (centerOffset.y - startTranslateY) / startScale;
        isPinching = true;
        isPanning = false;
        content.classList.add('is-touch-zooming');

        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (event.touches.length === 1 && scale > 1.01) {
        panStartX = event.touches[0].clientX;
        panStartY = event.touches[0].clientY;
        startTranslateX = translateX;
        startTranslateY = translateY;
        isPanning = true;
        content.classList.add('is-touch-zooming');

        event.preventDefault();
        event.stopPropagation();
      }
    }, { passive: false });

    frame.addEventListener('touchmove', (event) => {
      if (isPinching && event.touches.length >= 2 && startDistance > 0) {
        const center = getTouchCenter(event.touches);
        const centerOffset = getCenterOffset(center);
        const nextScale = startScale * (getTouchDistance(event.touches) / startDistance);

        scale = clamp(nextScale, minScale, maxScale);
        translateX = centerOffset.x - pinchContentX * scale;
        translateY = centerOffset.y - pinchContentY * scale;
        applyTransform();

        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (isPanning && event.touches.length === 1 && scale > 1.01) {
        translateX = startTranslateX + (event.touches[0].clientX - panStartX);
        translateY = startTranslateY + (event.touches[0].clientY - panStartY);
        applyTransform();

        event.preventDefault();
        event.stopPropagation();
      }
    }, { passive: false });

    frame.addEventListener('touchend', (event) => {
      if (!isPinching && !isPanning) return;

      if (event.touches.length === 1 && scale > 1.01) {
        panStartX = event.touches[0].clientX;
        panStartY = event.touches[0].clientY;
        startTranslateX = translateX;
        startTranslateY = translateY;
        isPinching = false;
        isPanning = true;
      } else if (event.touches.length === 0) {
        isPinching = false;
        isPanning = false;
        settleTouchZoom();
      }

      event.preventDefault();
      event.stopPropagation();
    }, { passive: false });

    frame.addEventListener('touchcancel', resetTouchZoom, { passive: true });

    image.addEventListener('load', resetTouchZoom);
    window.addEventListener('resize', () => {
      if (scale <= 1.01) return;
      applyTransform();
    });

    if (lightbox && 'MutationObserver' in window) {
      const observer = new MutationObserver(() => {
        if (!lightbox.classList.contains('show')) resetTouchZoom();
      });
      observer.observe(lightbox, { attributes: true, attributeFilter: ['class'] });
    }
  });
}
