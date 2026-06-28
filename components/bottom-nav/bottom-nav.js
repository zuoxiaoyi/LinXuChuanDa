Component({
  properties: {
    current: {
      type: String,
      value: ''
    }
  },

  methods: {
    onNavigate(e) {
      const page = e.currentTarget.dataset.page
      if (!page || page === this.data.current) return

      const routes = {
        home: '/pages/index/index',
        mine: '/pages/mine/mine'
      }
      wx.reLaunch({ url: routes[page] })
    }
  }
})
