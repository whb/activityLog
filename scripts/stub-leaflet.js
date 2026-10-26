function layer() {
  return {
    addTo() { return this; },
    bindTooltip() { return this; },
    clearLayers() { return this; },
    setLatLng() { return this; },
  };
}
function map() {
  return {
    setView() {}, fitBounds() {}, remove() {}, invalidateSize() {},
    on() {}, off() {}, removeLayer() {}, zoomIn() {}, zoomOut() {},
  };
}
export default {
  map,
  tileLayer: () => ({ addTo() {} }),
  polyline: layer,
  circleMarker: layer,
  marker: layer,
  layerGroup: () => ({ addTo() { return this; }, clearLayers() { return this; } }),
};
