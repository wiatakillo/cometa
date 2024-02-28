import {
  Component,
  ChangeDetectionStrategy,
  Output,
  EventEmitter,
  OnInit,
  Input,
} from '@angular/core';
import { UntypedFormControl, ReactiveFormsModule } from '@angular/forms';
import { BrowserFavouritedPipe } from '@pipes/browser-favourited.pipe';
import { BrowserstackState } from '@store/browserstack.state';
import { UserState } from '@store/user.state';
import { PlatformSortPipe } from '@pipes/platform-sort.pipe';
import { map } from 'rxjs/operators';
import { BrowsersState } from '@store/browsers.state';
import { BehaviorSubject } from 'rxjs';
import { ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import { classifyByProperty } from 'ngx-amvara-toolbox';
import { User } from '@store/actions/user.actions';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from '@ngxs/store';
import { LyridBrowsersState } from '@store/browserlyrid.state';
import { TranslateModule } from '@ngx-translate/core';
import { SortByPipe } from '@pipes/sort-by.pipe';
import { AddLatestPipe } from '../../pipes/add-latest.pipe';
import { BrowserComboTextPipe } from '../../pipes/browser-combo-text.pipe';
import { VersionSortPipe } from '@pipes/version-sort.pipe';
import { FormatVersionPipe } from '@pipes/format-version.pipe';
import { TranslateNamePipe } from '@pipes/translate-name.pipe';
import { CheckBrowserExistsPipe } from '@pipes/check-browser-exists.pipe';
import { CheckSelectedBrowserPipe } from '@pipes/check-selected-browser.pipe';
import { BrowserIconPipe } from '@pipes/browser-icon.pipe';
import { MatLegacyProgressSpinnerModule } from '@angular/material/legacy-progress-spinner';
import { LetDirective } from '../../directives/ng-let.directive';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { MatLegacyCheckboxModule } from '@angular/material/legacy-checkbox';
import { ContextMenuModule } from '@perfectmemory/ngx-contextmenu';
import { MatLegacyTooltipModule } from '@angular/material/legacy-tooltip';
import { StopPropagationDirective } from '../../directives/stop-propagation.directive';
import { MatLegacyInputModule } from '@angular/material/legacy-input';
import { MatLegacyOptionModule } from '@angular/material/legacy-core';
import { MatLegacySelectModule } from '@angular/material/legacy-select';
import { MatLegacyFormFieldModule } from '@angular/material/legacy-form-field';
import {
  NgIf,
  NgFor,
  NgClass,
  AsyncPipe,
  TitleCasePipe,
  KeyValuePipe,
} from '@angular/common';

/**
 * BrowserSelectionComponent
 * @description Component used to select the browser/s used for testing
 * @author Alex Barba
 * @emits Array of BrowserstackBrowser, see interfaces.d.ts
 * @example <cometa-browser-selection origin="browserstack" (selectionChange)="handleChange($event)"></cometa-browser-selection>
 */
@UntilDestroy()
@Component({
  selector: 'cometa-browser-selection',
  templateUrl: './browser-selection.component.html',
  styleUrls: ['./browser-selection.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [BrowserFavouritedPipe, PlatformSortPipe],
  standalone: true,
  imports: [
    NgIf,
    MatLegacyFormFieldModule,
    MatLegacySelectModule,
    ReactiveFormsModule,
    NgFor,
    MatLegacyOptionModule,
    MatLegacyInputModule,
    StopPropagationDirective,
    NgClass,
    MatLegacyTooltipModule,
    ContextMenuModule,
    MatLegacyCheckboxModule,
    MatLegacyButtonModule,
    MatIconModule,
    LetDirective,
    MatLegacyProgressSpinnerModule,
    AsyncPipe,
    TitleCasePipe,
    KeyValuePipe,
    PlatformSortPipe,
    BrowserIconPipe,
    CheckSelectedBrowserPipe,
    CheckBrowserExistsPipe,
    TranslateNamePipe,
    FormatVersionPipe,
    VersionSortPipe,
    BrowserFavouritedPipe,
    BrowserComboTextPipe,
    AddLatestPipe,
    SortByPipe,
    TranslateModule,
  ],
})
export class BrowserSelectionComponent implements OnInit {
  @Input() feature: Feature;

  @ViewSelectSnapshot(UserState.GetBrowserFavourites)
  favourites$: BrowserstackBrowser[];
  @ViewSelectSnapshot(BrowsersState.getBrowserJsons)
  localBrowsers$: BrowserstackBrowser[];
  @ViewSelectSnapshot(BrowserstackState) onlineBrowsers$: BrowserstackBrowser[];
  @ViewSelectSnapshot(LyridBrowsersState) lyridBrowsers$: BrowserstackBrowser[];

  @ViewSelectSnapshot(UserState.GetAvailableClouds) clouds$: Cloud[];

  getBrowserKey(key, version) {
    // Get unique key for platform selector values
    return `${key}%${version}`;
  }

  // MAX_CONCURRENCY = 100;
  MIN_CONCURRENCY = 1;
  DEFAULT_CONCURRENCY = 1;

  constructor(
    private _favouritePipe: BrowserFavouritedPipe,
    private _platformSort: PlatformSortPipe,
    private _store: Store
  ) {}

  testing_cloud = new UntypedFormControl('browserstack');
  browser = new UntypedFormControl();

  // Used for the loading screen
  loaded = new BehaviorSubject<boolean>(false);

  // Whenever some device/s is selected selectionChange will emit the array of browsers
  @Output() selectionChange = new EventEmitter<BrowserstackBrowser[]>();

  // Whenever the testing cloud control changes will emit the value
  @Output() testingCloud = new EventEmitter<string>();

  // Used to hold categories on the left panel
  categories = new BehaviorSubject<any>({});

  // Used to hold browsers and versions on the right panel
  browsers = new BehaviorSubject<any>({});

  // Used to hold all browsers but only for internal purposes
  categoriesInternal;

  rippleColor = 'rgba(0,0,0,0.05)';

  selectedCategory = new BehaviorSubject<string>('');
  selectedVersion = new BehaviorSubject<string>('');

  browsersSelected = new BehaviorSubject<BrowserstackBrowser[]>([]);

  ngOnInit() {
    try {
      this.browsersSelected.next(this.feature.browsers);
    } catch (err) {
      this.browsersSelected.next([]);
    }
    // Handle platform selection from mobile selector
    this.browser.valueChanges
      .pipe(
        untilDestroyed(this),
        map(browser => ({
          os: browser.split('%')[0],
          version: browser.split('%')[1],
        }))
      )
      .subscribe(browser => this.processVersion(browser.os, browser.version));
    // Get latest value comming from @Input and BrowserstackState
    this.testing_cloud.valueChanges
      .pipe(untilDestroyed(this))
      .subscribe(origin => {
        this.testingCloud.emit(origin);
        switch (origin) {
          // Origin: Browserstack
          case 'browserstack':
            this.rollupOS(this.onlineBrowsers$);
            break;
          // Origin: Local (Backend)
          case 'local':
            // Grab local browsers from backend instead of static ones from DataService
            this.rollupOS(this.localBrowsers$);
            break;
          case 'Lyrid.io':
            this.rollupOS(this.lyridBrowsers$);
            break;
          // Origin fallback: Local (Backend)
          default:
            // Grab local browsers from backend instead of static ones from DataService
            this.rollupOS(this.localBrowsers$);
        }
      });
    // Check if feature has a cloud assigned, fallback is browserstack
    try {
      this.testing_cloud.setValue(this.feature.cloud || 'local');
    } catch (err) {
      this.testing_cloud.setValue('browserstack');
    }
  }

  showAll(browserKey: string) {
    // Show all versions for a given browser
    document
      .querySelector(`.versions.${browserKey}`)
      .classList.toggle('show_all');
  }

  toggleFavourite(browser: BrowserstackBrowser) {
    return this._favouritePipe.transform(browser, this.favourites$)
      ? this._store.dispatch(new User.RemoveBrowserFavourite(browser))
      : this._store.dispatch(new User.AddBrowserFavourite(browser));
  }

  deleteFavourite(fav: BrowserstackBrowser) {
    // Remove favourite
    return this._store.dispatch(new User.RemoveBrowserFavourite(fav));
  }

  clickOnCategory(key, ev: MouseEvent) {
    if (this.selectedCategory.getValue() === key) {
      this.selectedCategory.next('');
    } else {
      this.selectedCategory.next(key);
    }
  }

  // Classify for Operating Systems
  rollupOS(browsers: BrowserstackBrowser[]) {
    // Check if there's at least 1 browser to process
    if (browsers.length > 0) {
      // First we classify operating systems as category
      const categories = classifyByProperty(browsers, 'os');
      // Second we classify each operating system by OS version
      const categoryArray: any = {};
      // tslint:disable-next-line: forin
      for (const name in categories) {
        categories[name] = classifyByProperty(categories[name], 'os_version');
        // tslint:disable-next-line: forin
        categoryArray[name] = Object.keys(categories[name]);
      }
      this.categoriesInternal = categories;
      this.categories.next(categoryArray);
      const firstCategory = Object.keys(categories)[0];
      this.selectedCategory.next(firstCategory);
      const latestVersion = this._platformSort.transform(
        Object.keys(categories[firstCategory]),
        firstCategory
      )[0];
      this.selectedVersion.next(latestVersion);
      this.processVersion(firstCategory, latestVersion);
    } else {
      this.loaded.next(true);
      // Try to switch to local / browserstack
      // Check local and online
      if (this.localBrowsers$.length > 0) {
        this.testing_cloud.setValue('local');
      } else if (this.onlineBrowsers$.length > 0) {
        this.testing_cloud.setValue('browserstack');
      }
    }
  }

  // Classify by browser based on the select operating system and version
  processVersion(os: string, version: string, ev?: MouseEvent) {
    this.selectedVersion.next(version);
    let browsers = this.categoriesInternal[os][version];
    browsers = classifyByProperty(browsers, 'browser');
    this.browsers.next(browsers);
    this.loaded.next(true);
    this.browser.setValue(`${os}%${version}`, { emitEvent: false });
  }

  // Function to handle when the user checks or unchecks the browsers
  handleCheckbox(browser, checked: boolean) {
    if (checked) {
      const selectedBrowsers = this.browsersSelected.getValue();
      selectedBrowsers.push(browser);
      this.browsersSelected.next(selectedBrowsers);
    } else {
      const selectedBrowsers = this.browsersSelected.getValue();
      const index = selectedBrowsers.findIndex(
        br =>
          this.toJson(br, ['concurrency']) ===
          this.toJson(browser, ['concurrency'])
      );
      selectedBrowsers.splice(index, 1);
      this.browsersSelected.next(selectedBrowsers);
    }
    this.selectionChange.emit(this.browsersSelected.getValue());
  }

  handleConcurrencyChange(browser, element) {
    const selectedBrowsers = this.browsersSelected.getValue();
    const br = selectedBrowsers.find(
      br =>
        this.toJson(br, ['concurrency']) ===
        this.toJson(browser, ['concurrency'])
    );
    br.concurrency = parseInt(element.value);
  }

  getCurrentlySelectedBrowser(browser) {
    const selectedBrowsers = this.browsersSelected.getValue();
    const br = selectedBrowsers.find(
      br =>
        this.toJson(br, ['concurrency']) ===
        this.toJson(browser, ['concurrency'])
    );
    return br;
  }

  getSelectedCloud() {
    return this.clouds$.find(cloud => cloud.name === this.testing_cloud.value);
  }

  toJson(json_object, fields_to_ignore) {
    const obj = { ...json_object };

    for (let field of fields_to_ignore) {
      delete obj[field];
    }

    return JSON.stringify(obj);
  }
}
