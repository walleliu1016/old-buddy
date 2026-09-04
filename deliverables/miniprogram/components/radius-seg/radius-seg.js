Component({
  properties: {
    radii: { type: Array, value: [1, 3, 5, 10] },
    current: { type: Number, value: 1 },
    stats: { type: Object, value: {} }
  },
  methods: {
    onTap(e) {
      const r = Number(e.currentTarget.dataset.r);
      this.triggerEvent("change", { radius: r });
    }
  }
});
