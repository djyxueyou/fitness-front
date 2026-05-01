export const routes = {
  home: '/pages/home/index',
  exercises: '/pages/exercises/index',
  profile: '/pages/profile/index',
  selectTemplate: '/pages/home/select-template',
  workoutActive: '/pages/home/workout-active',
  workoutCalendar: '/pages/home/workout-calendar',
  volumeTrend: '/pages/home/volume-trend',
  historyDetail: '/pages/home/history-detail',
  exerciseDetail: '/pages/exercises/detail',
  profileHistory: '/pages/profile/history',
  templateManager: '/pages/profile/template-manager',
  favorites: '/pages/profile/favorites',
  settings: '/pages/profile/settings',
  about: '/pages/profile/about'
} as const

export function goBack() {
  uni.navigateBack()
}
