const layer = () => ({ addTo() { return this; }, bindTooltip() { return this; } });
export default {
  map: () => ({ setView() {}, fitBounds() {}, remove() {} }),
  tileLayer: () => ({ addTo() {} }),
  polyline: layer,
  circleMarker: layer,
  marker: layer,
};
