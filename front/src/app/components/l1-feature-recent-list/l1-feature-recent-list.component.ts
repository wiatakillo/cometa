/**
 * l1-feature-recent-list.component.ts
 *
 * Contains the code to control the behaviour of the list containing the recent features of the new landing
 *
 * @date 04-10-21
 *
 * @lastModification 12-10-21
 *
 * @author: dph000
 */

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { Select, Store } from '@ngxs/store';
import { CustomSelectors } from '@others/custom-selectors';
import { SharedActionsService } from '@services/shared-actions.service';
import { BehaviorSubject, Observable, switchMap, tap } from 'rxjs';
import { MatLegacyTableDataSource as MatTableDataSource } from '@angular/material/legacy-table';
import { MatLegacyPaginator as MatPaginator } from '@angular/material/legacy-paginator';
import { MatSort } from '@angular/material/sort';
import { Features } from '@store/actions/features.actions';
import { Subscribe } from 'ngx-amvara-toolbox';
import { AddFolderComponent } from '@dialogs/add-folder/add-folder.component';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { ApiService } from '@services/api.service';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import { ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import { UserState } from '@store/user.state';
import { Configuration } from '@store/actions/config.actions';
import { LogService } from '@services/log.service';
import { FeatureRunningPipe } from '../../pipes/feature-running.pipe';
import { DepartmentNamePipe } from '@pipes/department-name.pipe';
import { HasPermissionPipe } from '../../pipes/has-permission.pipe';
import { BrowserComboTextPipe } from '../../pipes/browser-combo-text.pipe';
import { LoadingPipe } from '@pipes/loading.pipe';
import { BrowserIconPipe } from '@pipes/browser-icon.pipe';
import { SecondsToHumanReadablePipe } from '@pipes/seconds-to-human-readable.pipe';
import { AmDateFormatPipe } from '@pipes/am-date-format.pipe';
import { AmParsePipe } from '@pipes/am-parse.pipe';
import { TranslateModule } from '@ngx-translate/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatLegacyMenuModule } from '@angular/material/legacy-menu';
import { MatLegacyCheckboxModule } from '@angular/material/legacy-checkbox';
import { StopPropagationDirective } from '../../directives/stop-propagation.directive';
import { MatLegacyTooltipModule } from '@angular/material/legacy-tooltip';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { MatLegacyProgressSpinnerModule } from '@angular/material/legacy-progress-spinner';
import { MatLegacyFormFieldModule } from '@angular/material/legacy-form-field';
import { MatLegacySelectModule } from '@angular/material/legacy-select';
import { WelcomeComponent } from '../welcome/welcome.component';
import { MtxGridModule } from '@ng-matero/extensions/grid';
import {
  NgIf,
  NgClass,
  NgSwitch,
  NgSwitchCase,
  NgSwitchDefault,
  NgFor,
  AsyncPipe,
  LowerCasePipe,
} from '@angular/common';
import {
  UntypedFormControl,
  UntypedFormGroup,
  Validators,
  UntypedFormBuilder,
  ReactiveFormsModule,
} from '@angular/forms';
import { LetDirective } from '../../directives/ng-let.directive';
import { Router } from '@angular/router';
import { SortByPipe } from '@pipes/sort-by.pipe';
import { DepartmentsState } from '@store/departments.state';
import { InputFocusService } from '../../services/inputFocus.service';
import { I } from '@angular/cdk/keycodes';
import { stringify } from 'querystring';
import { FeaturesState } from '@store/features.state';


@Component({
  selector: 'cometa-l1-feature-recent-list',
  templateUrl: './l1-feature-recent-list.component.html',
  styleUrls: ['./l1-feature-recent-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    ReactiveFormsModule,
    LetDirective,
    NgIf,
    MtxGridModule,
    WelcomeComponent,
    MatLegacyProgressSpinnerModule,
    MatLegacyButtonModule,
    MatIconModule,
    MatLegacyFormFieldModule,
    MatLegacySelectModule,
    MatLegacyTooltipModule,
    NgClass,
    NgSwitch,
    NgSwitchCase,
    NgSwitchDefault,
    NgFor,
    StopPropagationDirective,
    MatLegacyCheckboxModule,
    MatLegacyMenuModule,
    MatDividerModule,
    TranslateModule,
    AmParsePipe,
    AmDateFormatPipe,
    SecondsToHumanReadablePipe,
    BrowserIconPipe,
    LoadingPipe,
    BrowserComboTextPipe,
    HasPermissionPipe,
    DepartmentNamePipe,
    FeatureRunningPipe,
    AsyncPipe,
    LowerCasePipe,
    SortByPipe  
  ],
})
export class L1FeatureRecentListComponent {
  
  featureForm: UntypedFormGroup;

  constructor(
    private _store: Store,
    public _sharedActions: SharedActionsService,
    private _router: Router,
    private _dialog: MatDialog,
    private _api: ApiService,
    private _snackBar: MatSnackBar,
    private log: LogService,
    private _fb: UntypedFormBuilder,
    private inputFocusService: InputFocusService,


  ) {
    this.featureForm = this._fb.group({
      department_name: ['', Validators.required],
    });
  }

  // Contains the new structure of the features / folders
  @Input() data$: any;
  @Select(CustomSelectors.GetConfigProperty('sorting'))
  sorting$: Observable<string>;
  @Select(CustomSelectors.GetConfigProperty('reverse'))
  reverse$: Observable<boolean>;
  @Select(CustomSelectors.GetConfigProperty('openedSearch'))
  openedSearch$: Observable<boolean>;
  // Initializes the sorting and pagination variables
  @ViewChild(MatSort, { static: false }) sort: MatSort;
  @ViewChild(MatPaginator) paginator: MatPaginator;
  // Checks if the user can create a feature and has a subscription
  @ViewSelectSnapshot(UserState.GetPermission('create_feature'))
  canCreateFeature: boolean;
  @ViewSelectSnapshot(UserState.HasOneActiveSubscription)
  hasSubscription: boolean;
  @Output() closeAdd: EventEmitter<any> = new EventEmitter();
  departments$!: Department[];
  @Select(DepartmentsState) allDepartments$: Observable<Department[]>;
  @ViewSelectSnapshot(UserState) user!: UserInfo;


  /**
   * Global variables
   */

  isVisible = false;
  selected_department: string;
  /**
   * List of columns to be shown on the feature list
   * The format is due to mtx-grid. To see more go to https://ng-matero.github.io/extensions/components/data-grid/overview
   */
  columns = [
    { header: 'Run', field: 'type' },
    { header: 'Last run', field: 'date', sortable: true, sort: 'desc' },  
    {
      header: 'Name',
      field: 'name',
      pinned: 'left',
      class: 'name',
      sortable: true,
    },
    { header: 'Status', field: 'status', sortable: true },
    { header: 'Duration', field: 'time', sortable: true },
    { header: 'Steps', field: 'total', sortable: true },
    { header: 'Modified on', field: 'modification', sortable: true },
    { header: 'ID', field: 'id', sortable: true },
    { header: 'Department', field: 'department', sortable: true },
    { header: 'Application', field: 'app', sortable: true },
    { header: 'Environment', field: 'environment', sortable: true },
    { header: 'Browsers', field: 'browsers', sortable: true },
    { header: 'Schedule', field: 'schedule', sortable: true },
    { header: 'Options', field: 'reference' },
  ];
  // Mtx-grid row selection checkbox options
  multiSelectable = true;
  rowSelectable = true;
  hideRowSelectionCheckbox = true;

  // Mtx-grid column move and hide options
  columnHideable = true;
  columnMovable = true;
  columnHideableChecked: 'show' | 'hide' = 'show';

  // Mtx-grid stripped options
  rowHover = true;
  rowStriped = true;

  // Creates a source for the data
  tableValues = new BehaviorSubject<MatTableDataSource<any>>(
    new MatTableDataSource<any>([])
  );

  inputFocus: boolean = false;


  /**
   * Global functions
   */


  ngOnInit() {
    this.allDepartments$.subscribe(departments => {
      console.log('preselected:', this.user.settings.preselectDepartment);
      this.departments$ = departments;
    });

    if(localStorage.getItem('co_recent_sort_type') === 'dpt') {
      this.isVisible = true;
    } else if (localStorage.getItem('co_recent_sort_type') === 'my') {
      this.isVisible = false;
    }

    this.log.msg('l1-feature-recent.component.ts','Initializing selected_department as the preselected department','','')
    //If user has no preselected department, it will select Default by default, else it will select based on user settings.
    if(this.user.settings.preselectDepartment == null){
      this.selected_department = 'Default'
      FeaturesState.static_setSelectedDepartment(0);
    } else {
      //preselected departments numeration starts at 1 (need to normalize)
      this.selected_department = this.departments$[this.user.settings.preselectDepartment - 1].department_name
      FeaturesState.static_setSelectedDepartment(this.departments$[this.user.settings.preselectDepartment - 1].department_id - 1)
    }
  }

  // Checks whether the clicked row is a feature or a folder and opens it
  openContent(row: any) {
    switch (row.type) {
      case 'feature':
        this.log.msg(
          '1',
          'opening feature with id...',
          'feature-recent-list',
          row.id
        );
        this._sharedActions.goToFeature(row.id);
        break;
      case 'folder':
        this.log.msg(
          '1',
          'opening folder with route...',
          'feature-recent-list',
          row.route
        );
        this.setFolder(row.route);
        break;
      default:
        break;
    }
  }

  // Closes the add feature / folder menu
  closeAddButtons() {
    this.closeAdd.emit(null);
  }

  /**
   * Folder control functions
   */

  // Go to the clicked route
  setFolder(route: Folder[]) {
    this.log.msg('1', 'Setting folder route...', 'feature-recent-list', route);
    this._store.dispatch(new Features.SetFolderRoute(route));
  }

  // Go to the clicked folder
  goFolder(folder: Folder) {
    this.log.msg(
      '1',
      'redirecting to folder...',
      'feature-recent-list',
      folder
    );
    return this._store.dispatch(new Features.NewAddFolderRoute(folder));
  }

  // Modify the clicked folder
  modify(folder: Folder) {
    this.log.msg('1', 'Editing folder...', 'feature-recent-list', folder);
    this._dialog.open(AddFolderComponent, {
      autoFocus: true,
      data: {
        mode: 'edit',
        folder: folder,
      } as IEditFolder,
    });
  }

  // Delete the clicked folder
  @Subscribe()
  delete(folder: Folder) {
    this.log.msg('1', 'Deleting folder...', 'feature-recent-list', folder);
    return this._api.removeFolder(folder.folder_id).pipe(
      switchMap(_ => this._store.dispatch(new Features.GetFolders())),
      tap(_ => this._snackBar.open(`Folder ${folder.name} removed`, 'OK'))
    );
  }

  // Gets and sets the variable from config file to open/close the sidenav
  /**
   * Opens the sidenav whenever the user clicks on the toggle sidenav button on mobile
   * or closes it if the user clicks outside of the sidenav container or goes to another folder
   *
   * @return sets the current status of the sidenav on mobile
   */
  toggleSidenav() {
    this.log.msg('1', 'Toggling sidenav...', 'feature-recent-list');
    const opened = this._store.selectSnapshot<boolean>(
      CustomSelectors.GetConfigProperty('openedSidenav')
    );
    return this._store.dispatch(
      new Configuration.SetProperty('openedSidenav', !opened)
    );
  }

  /**
   * Shared Actions functions
   */

  // Opens a menu to create a new feature
  SAopenCreateFeature() {
    this.log.msg('1', 'Opening create feature menu...', 'feature-recent-list');
    this._sharedActions.openEditFeature();
  }

  // Runs the clicked feature
  SArunFeature(id: number) {
    this.log.msg('1', 'Running feature with id...', 'feature-recent-list', id);
    this._sharedActions.run(id);
  }

  // Edits the schedule of the clicked feature
  SAeditSchedule(id: number) {
    this.log.msg(
      '1',
      'Editing shedule of feature with id...',
      'feature-recent-list',
      id
    );
    this._sharedActions.editSchedule(id);
  }

  // Opens the menu to edit the clicked feature
  SAopenEditFeature(id: number, mode) {
    this.log.msg('1', 'Editing feature with id...', 'feature-recent-list', id);
    this._sharedActions.openEditFeature(id, mode);
  }

  // Moves the selected feature
  SAmoveFeature(feature: Feature, previousFolder?: number) {
    this.log.msg('1', 'Moving feature...', 'feature-recent-list', feature);
    this._sharedActions.moveFeature(feature);
  }

  // Handles the settings of the clicked feature
  SAhandleSetting(id: number, mode, event) {
    this.log.msg(
      '1',
      'Handling setting of feature width id...',
      'feature-recent-list',
      id
    );
    this._sharedActions.handleSetting(id, mode, event);
  }

  SAdeleteFeature(id: number) {
    this.log.msg(
      '1',
      'Deleting feature width id...',
      'feature-recent-list',
      id
    );
    this._sharedActions.deleteFeature(id);
  }

  // Moves the selected folder
  SAmoveFolder(folder: Folder) {
    this.log.msg('1', 'Moving folder...', 'feature-recent-list', folder);
    this._sharedActions.moveFolder(folder);
  }

  hideSidenav() {
    return this._store.dispatch(
      new Configuration.SetProperty('openedSidenav', false)
    );
  }

  toggleListType(listType: string) {
    this.log.msg('1', 'Navigating to root(home)...', 'folder-tree');
    this._sharedActions.set_url_folder_params('');

    this._router.navigate(['/new']);
    return this._store.dispatch(
      new Configuration.SetProperty('co_active_list', listType, true)
    );
  }

  toggleList(listType: string) {
    this.hideSidenav(); // Hide the sidenav on mobile
    this.toggleListType(listType); // Toggles the list type
    this._store.dispatch(new Features.ReturnToFolderRoute(0)); // Remove the current route
  }

  //Changes view to recent by department
  //WIP current departent should be loaded from selected in a future dropdown
  sortRecent(sortType: string) {

    localStorage.setItem('co_recent_sort_type', sortType);
    this.log.msg('l1-feature-recent-list.component.ts','392','Added, [' + sortType + '] to Localstorage','')
    // Make dropdown visibility persist uf needed,
    if(localStorage.getItem('co_recent_sort_type') === 'dpt') {
      this.isVisible = true;
    } else if (localStorage.getItem('co_recent_sort_type') === 'my') {
      this.isVisible = false;
    }
    //refresh UI
    this.toggleList('recent')
  }

  onDepartmentChange() {
    this._sharedActions.setSelectedDepartment(this.selected_department);
    //When switchin options in the dropdown, we update the UI and call FutureState to sort by the new option.
    for (const department of this.user.departments) {
      if(department.department_name == this.selected_department){
        FeaturesState.static_setSelectedDepartment(department.department_id-1)
        //refresh UI
        this.toggleList('recent')
      }
    }
  }

  onInputFocus() {
    this.inputFocus = true;
  }

  onInputBlur() {
    this.inputFocus = false;
  }
}
