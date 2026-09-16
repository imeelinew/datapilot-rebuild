export type SandboxZone = {
  id: string
  name: string
  category: string
  floors: number
  position: [number, number]
  color: string
}

export const sandboxZones: SandboxZone[] = [
  { id: 'command', name: '城市指挥中心', category: '公共管理', floors: 8, position: [-3.4, -3.4], color: '#4f8ecb' },
  { id: 'office', name: '政务服务楼', category: '公共服务', floors: 5, position: [0, -3.4], color: '#7b9dc8' },
  { id: 'energy', name: '能源管理中心', category: '城市设施', floors: 4, position: [3.4, -3.4], color: '#49a5a0' },
  { id: 'school', name: '智慧学校', category: '教育', floors: 3, position: [-3.4, 0], color: '#d0a46b' },
  { id: 'park', name: '中心公园', category: '公共空间', floors: 0, position: [0, 0], color: '#62ad72' },
  { id: 'hospital', name: '城市医院', category: '医疗', floors: 5, position: [3.4, 0], color: '#d48988' },
  { id: 'transit', name: '交通枢纽', category: '交通', floors: 3, position: [-3.4, 3.4], color: '#7a91bf' },
  { id: 'business', name: '商业中心', category: '商业', floors: 7, position: [0, 3.4], color: '#a084c5' },
  { id: 'residential', name: '居住社区', category: '居住', floors: 6, position: [3.4, 3.4], color: '#c9948a' },
]
