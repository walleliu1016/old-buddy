Component({
  properties: {
    activity: { type: Object, value: {} },
    fav: { type: Boolean, value: false }
  },
  data: { free: false },
  observers: {
    activity(a) {
      if (a && a.fee != null) {
        this.setData({ free: /免费|0\s*元|免收/.test(a.fee) });
      }
    }
  },
  methods: {
    onTap() { this.triggerEvent("tap", { id: this.data.activity.id }); },
    onFav() { this.triggerEvent("fav", { id: this.data.activity.id }); }
  }
});
