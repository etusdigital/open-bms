export class DashboardDto {
  general?: Date;
  daily?: Date;

  constructor(dashboardDto: DashboardDto = {} as DashboardDto) {
    this.general = dashboardDto.general;
    this.daily = dashboardDto.daily;
  }
}
