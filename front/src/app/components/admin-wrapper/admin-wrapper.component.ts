import { Component, ChangeDetectionStrategy } from '@angular/core';
import { Select } from '@ngxs/store';
import { UserState } from '@store/user.state';
import { Observable } from 'rxjs';

@Component({
  selector: 'admin-wrapper',
  templateUrl: './admin-wrapper.component.html',
  styleUrls: ['./admin-wrapper.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminWrapperComponent {
  @Select(UserState.GetPermission('view_accounts_panel'))
  canViewAccounts$: Observable<boolean>;
  @Select(UserState.GetPermission('view_applications_panel'))
  canViewApplications$: Observable<boolean>;
  @Select(UserState.GetPermission('view_browsers_panel'))
  canViewBrowsers$: Observable<boolean>;
  @Select(UserState.GetPermission('view_departments_panel'))
  canViewDepartments$: Observable<boolean>;
  @Select(UserState.GetPermission('view_environments_panel'))
  canViewEnvironments$: Observable<boolean>;
  @Select(UserState.GetPermission('view_features_panel'))
  canViewFeatures$: Observable<boolean>;
  @Select(UserState.GetPermission('view_others_panel'))
  canViewOthers$: Observable<boolean>;

  links: string[] = [
    'departments',
    'applications',
    'browsers',
    'environments',
    'features',
    'accounts',
    'others',
  ];
}
