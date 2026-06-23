/**
 * 云函数 - seedOutfits
 * 功能：一键填充穿搭测试数据到 outfits 集合
 * 用法：部署后在云开发控制台手动触发，或小程序内调用一次后即可删除
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

// ============ 测试数据 ============
const TEST_OUTFITS = [
  {
    title: '夏日清新通勤风',
    coverUrl: 'cloud://cloudbase-d7gr1giub2c847b49.636c-cloudbase-d7gr1giub2c847b49-1428666830/demo/outfit1.jpg',
    images: [],
    tags: ['通勤', '夏日', '清新'],
    description: '浅蓝色条纹衬衫搭配米白色阔腿裤，简约而不失优雅。配上一双白色乐福鞋和浅棕色托特包，整体色调统一柔和，非常适合夏日通勤。',
    items: [
      { name: '条纹衬衫', brand: 'ZARA', imageUrl: '' },
      { name: '阔腿裤', brand: 'UNIQLO', imageUrl: '' },
      { name: '乐福鞋', brand: 'Charles&Keith', imageUrl: '' }
    ],
    season: 'summer',
    gender: 'female',
    isLocked: false,
    createTime: new Date('2026-06-01')
  },
  {
    title: '周末约会甜美感',
    coverUrl: 'cloud://cloudbase-d7gr1giub2c847b49.636c-cloudbase-d7gr1giub2c847b49-1428666830/demo/outfit2.jpg',
    images: [],
    tags: ['约会', '甜美', '连衣裙'],
    description: '碎花V领连衣裙，收腰设计凸显身材比例。搭配珍珠耳钉和米色细带凉鞋，甜美中带着精致感，适合周末约会或闺蜜下午茶。',
    items: [
      { name: '碎花连衣裙', brand: 'URBAN REVIVO', imageUrl: '' },
      { name: '细带凉鞋', brand: 'Stradivarius', imageUrl: '' },
      { name: '珍珠耳钉', brand: 'APM Monaco', imageUrl: '' }
    ],
    season: 'summer',
    gender: 'female',
    isLocked: false,
    createTime: new Date('2026-06-02')
  },
  {
    title: '街头潮流运动风',
    coverUrl: 'cloud://cloudbase-d7gr1giub2c847b49.636c-cloudbase-d7gr1giub2c847b49-1428666830/demo/outfit3.jpg',
    images: [],
    tags: ['街头', '运动', '潮流'],
    description: '宽松印花T恤搭配束脚运动裤，脚踩经典AJ运动鞋。配上棒球帽和斜挎包，潮酷有型又舒适，逛街运动两不误。',
    items: [
      { name: '印花T恤', brand: 'NIKE', imageUrl: '' },
      { name: '束脚运动裤', brand: 'Adidas', imageUrl: '' },
      { name: 'AJ运动鞋', brand: 'Air Jordan', imageUrl: '' }
    ],
    season: 'spring',
    gender: 'male',
    isLocked: false,
    createTime: new Date('2026-06-03')
  },
  {
    title: '轻熟职场精英范',
    coverUrl: 'cloud://cloudbase-d7gr1giub2c847b49.636c-cloudbase-d7gr1giub2c847b49-1428666830/demo/outfit4.jpg',
    images: [],
    tags: ['职场', '轻熟', '西装'],
    description: '深灰色修身西装外套内搭白色真丝衬衫，下身同色系西装裤。整体干练利落，配上银色腕表和黑色尖头高跟鞋，气场十足。',
    items: [
      { name: '西装外套', brand: 'Theory', imageUrl: '' },
      { name: '真丝衬衫', brand: 'Equipment', imageUrl: '' },
      { name: '尖头高跟鞋', brand: 'Jimmy Choo', imageUrl: '' }
    ],
    season: 'autumn',
    gender: 'female',
    isLocked: true,
    createTime: new Date('2026-06-04')
  },
  {
    title: '假日休闲度假风',
    coverUrl: 'cloud://cloudbase-d7gr1giub2c847b49.636c-cloudbase-d7gr1giub2c847b49-1428666830/demo/outfit5.jpg',
    images: [],
    tags: ['度假', '休闲', '海边'],
    description: '亚麻材质宽松衬衫敞开穿，内搭白色背心，下身卡其色短裤。草帽和墨镜是点睛之笔，慵懒随性又极具度假氛围。',
    items: [
      { name: '亚麻衬衫', brand: 'MUJI', imageUrl: '' },
      { name: '卡其短裤', brand: 'UNIQLO', imageUrl: '' },
      { name: '草帽', brand: 'H&M', imageUrl: '' }
    ],
    season: 'summer',
    gender: 'male',
    isLocked: false,
    createTime: new Date('2026-06-05')
  },
  {
    title: '秋冬叠穿层次感',
    coverUrl: 'cloud://cloudbase-d7gr1giub2c847b49.636c-cloudbase-d7gr1giub2c847b49-1428666830/demo/outfit6.jpg',
    images: [],
    tags: ['秋冬', '叠穿', '复古'],
    description: '高领打底衫外搭格纹毛呢西装，再叠穿驼色大衣。下身搭配直筒牛仔裤和切尔西靴，三层叠穿保暖又有层次感。',
    items: [
      { name: '驼色大衣', brand: 'MaxMara', imageUrl: '' },
      { name: '格纹西装', brand: 'ZARA', imageUrl: '' },
      { name: '切尔西靴', brand: 'Dr.Martens', imageUrl: '' }
    ],
    season: 'winter',
    gender: 'female',
    isLocked: true,
    createTime: new Date('2026-06-06')
  },
  {
    title: '学院风减龄穿搭',
    coverUrl: 'cloud://cloudbase-d7gr1giub2c847b49.636c-cloudbase-d7gr1giub2c847b49-1428666830/demo/outfit7.jpg',
    images: [],
    tags: ['学院', '减龄', '日常'],
    description: '白色Polo衫搭配百褶短裙，外搭针织开衫。配上中筒袜和小白鞋，满满的校园青春气息，减龄效果满分。',
    items: [
      { name: '针织开衫', brand: 'Ralph Lauren', imageUrl: '' },
      { name: '百褶短裙', brand: 'Bershka', imageUrl: '' },
      { name: '小白鞋', brand: 'Adidas', imageUrl: '' }
    ],
    season: 'spring',
    gender: 'female',
    isLocked: false,
    createTime: new Date('2026-06-07')
  },
  {
    title: '极简黑白灰',
    coverUrl: 'cloud://cloudbase-d7gr1giub2c847b49.636c-cloudbase-d7gr1giub2c847b49-1428666830/demo/outfit8.jpg',
    images: [],
    tags: ['极简', '高级感', '黑白灰'],
    description: '黑色圆领针织衫搭配白色直筒西裤，外披灰色长款风衣。黑白灰三色经典搭配，极简风格永不过时，适合各种场合。',
    items: [
      { name: '圆领针织衫', brand: 'COS', imageUrl: '' },
      { name: '直筒西裤', brand: 'UNIQLO', imageUrl: '' },
      { name: '长款风衣', brand: 'Burberry', imageUrl: '' }
    ],
    season: 'autumn',
    gender: 'female',
    isLocked: false,
    createTime: new Date('2026-06-08')
  }
]

/**
 * 主函数：批量插入测试数据
 */
exports.main = async (event, context) => {
  try {
    // 先清空旧测试数据（可选，注释掉则不删除）
    // await db.collection('outfits').where({}).remove()

    // 批量插入
    const results = []
    for (const outfit of TEST_OUTFITS) {
      const res = await db.collection('outfits').add({ data: outfit })
      results.push({ _id: res._id, title: outfit.title })
    }

    return {
      success: true,
      count: results.length,
      message: `成功插入 ${results.length} 条穿搭测试数据`,
      data: results
    }
  } catch (err) {
    console.error('插入测试数据失败:', err)
    return {
      success: false,
      message: '插入失败: ' + err.message
    }
  }
}
