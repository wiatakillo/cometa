import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  Input,
  ChangeDetectorRef,
  Host,
  ElementRef,
  NgZone,
  ViewChild,
  ViewChildren,
  QueryList,
  Renderer2,
  Output,
  EventEmitter,
  HostListener,
} from '@angular/core';
import {
  CdkDragDrop,
  CdkDropList,
  CdkDrag,
  CdkDragHandle,
} from '@angular/cdk/drag-drop';
import { AddStepComponent } from '@dialogs/add-step/add-step.component';
import { InputFocusService } from '../../services/inputFocus.service';
import {
  MatLegacyDialog as MatDialog,
  MatLegacyDialogRef as MatDialogRef,
} from '@angular/material/legacy-dialog';
import { ApiService } from '@services/api.service';
import { Store } from '@ngxs/store';
import { ActionsState } from '@store/actions.state';
import { ClipboardService } from 'ngx-clipboard';
import { ImportJSONComponent } from '@dialogs/import-json/import-json.component';
import {
  BehaviorSubject,
  debounceTime,
  distinctUntilChanged,
  forkJoin,
  of,
} from 'rxjs';
import { CustomSelectors } from '@others/custom-selectors';
import {
  UntypedFormArray,
  UntypedFormBuilder,
  Validators,
  ReactiveFormsModule,
  FormGroup,
  FormControl,
} from '@angular/forms';
import { ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import { UserState } from '@store/user.state';
import { CustomValidators } from '@others/custom-validators';
import { exportToJSONFile, SubSinkAdapter } from 'ngx-amvara-toolbox';
import { EditFeature } from '@dialogs/edit-feature/edit-feature.component';
import {
  MatLegacyAutocompleteSelectedEvent as MatAutocompleteSelectedEvent,
  MatLegacyAutocompleteModule,
} from '@angular/material/legacy-autocomplete';
import {
  AreYouSureData,
  AreYouSureDialog,
} from '@dialogs/are-you-sure/are-you-sure.component';
import {
  MatLegacyCheckboxChange as MatCheckboxChange,
  MatLegacyCheckboxModule,
} from '@angular/material/legacy-checkbox';
import {
  MatLegacyList as MatList,
  MatLegacyListItem as MatListItem,
  MatLegacyListModule,
} from '@angular/material/legacy-list';
import { TranslateModule } from '@ngx-translate/core';
import { CheckDuplicatePipe } from '../../pipes/check-duplicate.pipe';
import { FilterStepPipe } from '@pipes/filter-step.pipe';
import { LetDirective } from '../../directives/ng-let.directive';
import { StopPropagationDirective } from '../../directives/stop-propagation.directive';
import { MatLegacyMenuModule } from '@angular/material/legacy-menu';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { MatLegacyTooltipModule } from '@angular/material/legacy-tooltip';
import { TextFieldModule } from '@angular/cdk/text-field';
import { MatLegacyOptionModule } from '@angular/material/legacy-core';
import { MatLegacySelectModule } from '@angular/material/legacy-select';
import { NgFor, NgClass, NgIf, NgStyle, AsyncPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ContextMenuModule } from '@perfectmemory/ngx-contextmenu';
import { KEY_CODES } from '@others/enums';
import { LogService } from '@services/log.service';
import { MatAutocompleteActivatedEvent } from '@angular/material/autocomplete';
import { MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatSnackBar } from '@angular/material/snack-bar';



@Component({
  selector: 'cometa-step-editor',
  templateUrl: './step-editor.component.html',
  styleUrls: ['./step-editor.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    ContextMenuModule,
    MatIconModule,
    CdkDropList,
    NgFor,
    ReactiveFormsModule,
    CdkDrag,
    NgClass,
    CdkDragHandle,
    MatLegacyCheckboxModule,
    MatLegacySelectModule,
    MatLegacyOptionModule,
    TextFieldModule,
    MatLegacyAutocompleteModule,
    NgIf,
    MatLegacyListModule,
    NgStyle,
    MatLegacyTooltipModule,
    MatLegacyButtonModule,
    MatLegacyMenuModule,
    StopPropagationDirective,
    LetDirective,
    AsyncPipe,
    FilterStepPipe,
    CheckDuplicatePipe,
    TranslateModule,
  ],
})
export class StepEditorComponent extends SubSinkAdapter implements OnInit {
  stepsForm: UntypedFormArray;

  @ViewSelectSnapshot(ActionsState) actions: Action[];
  @ViewSelectSnapshot(UserState) user!: UserInfo;
  @Output() textareaFocusToParent = new EventEmitter<boolean>();

  @Input() feature: Feature;
  @Input() name: string;
  @Input() mode: 'new' | 'edit' | 'clone';
  @Input() variables: VariablePair[];
  @Input() department: Department;

  @ViewChildren(MatListItem, { read: ElementRef })
  varlistItems: QueryList<ElementRef>;
  @ViewChild(MatList, { read: ElementRef }) varlist: ElementRef;
  @ViewChild('variable_name', { read: ElementRef, static: false })
  varname: ElementRef;

  displayedVariables: (VariablePair | string)[] = [];
  stepVariableData = <VariableInsertionData>{};

  constructor(
    private _dialog: MatDialog,
    private _api: ApiService,
    private _snackBar: MatSnackBar,
    private _store: Store,
    private _clipboard: ClipboardService,
    private _fb: UntypedFormBuilder,
    private _cdr: ChangeDetectorRef,
    private _elementRef: ElementRef<HTMLElement>,
    private _ngZone: NgZone,
    public dialogRef: MatDialogRef<EditFeature>,
    @Host() public readonly _editFeature: EditFeature,
    private renderer: Renderer2,
    private inputFocusService: InputFocusService,
    private logger: LogService,
    private snack: MatSnackBar
  ) {
    super();
    this.stepsForm = this._fb.array([]);
  }

  // Shortcut emitter to parent component
  sendTextareaFocusToParent(isFocused: boolean, index?: number): void {
    this.textareaFocusToParent.emit(isFocused);

    if (index === undefined) {
      return;
    }

    // Esto hace que aparezca o desaparezca la guía de IA
    if (isFocused) {
      // Hacer visible el paso en la UI
      this.stepVisible[index] = true;

      const stepFormGroup = this.stepsForm.at(index) as FormGroup;
      // console.log(stepFormGroup);

      const stepAction = stepFormGroup.get('step_action')?.value;
      const stepContent = stepFormGroup.get('step_content')?.value;

      if (stepContent === undefined) {
        // Limpiar la descripción y ejemplos si el contenido está vacío
        this.descriptionText = '';
        this.examplesText = '';
        this._cdr.detectChanges();
        return;
      }

      const activatedAction = this.actions.find(action =>
        action.action_name === stepAction
      );

      if (activatedAction) {
        // Asignar título y descripción de la acción seleccionada
        this.selectedActionTitle = activatedAction.action_name;
        this.selectedActionDescription = activatedAction.description;

        // Limpiar las etiquetas <br> de la descripción
        this.selectedActionDescription = this.selectedActionDescription.replace(/<br\s*\/?>/gi, '');

        // Separar la descripción y ejemplos si es necesario
        if (this.selectedActionDescription.includes("Example")) {
          const parts = this.selectedActionDescription.split("Example:");
          this.descriptionText = parts[0].trim();
          this.examplesText = parts[1]?.trim() || '';
        } else {
          this.descriptionText = this.selectedActionDescription;
          this.examplesText = '';
        }

        // Actualizar la documentación del paso correspondiente
        const currentIndex = this.stepsForm.value.findIndex(step => step.step_action === stepAction);
        if (currentIndex !== -1) {
          this.stepsDocumentation[currentIndex] = {
            description: this.descriptionText,
            examples: this.examplesText
          };
        }

        this._cdr.detectChanges();
      }
    } else {
      if (index !== undefined) {
        this.stepVisible[index] = false;
      }
    }

    // console.log("stepVisible: ", this.stepVisible[index]);
  }

  setSteps(steps: FeatureStep[], clear: boolean = true) {
    if (clear) this.stepsForm.clear();
    steps.forEach(step => {
      this.stepsForm.push(
        this._fb.group({
          enabled: step.enabled,
          screenshot: step.screenshot,
          step_keyword: step.step_keyword,
          compare: step.compare,
          step_content: [
            step.step_content,
            CustomValidators.StepAction.bind(this),
          ],
          step_action: step.step_action || '',
          step_type: step.step_type,
          continue_on_failure: step.continue_on_failure,
          timeout:
            step.timeout ||
            this.department.settings?.step_timeout ||
            this._fb.control(
              60,
              Validators.compose([
                Validators.min(1),
                Validators.max(7205),
                Validators.maxLength(4),
              ])
            ),
        })
      );
    });
    this._cdr.detectChanges();
  }

  getSteps(): FeatureStep[] {
    return this.stepsForm.controls.map(control => control.value);
  }

  ngOnInit() {
    // @ts-ignore
    if (!this.feature) this.feature = { feature_id: 0 };
    const featureId = this.mode === 'clone' ? 0 : this.feature.feature_id;
    this.subs.sink = this._store
      .select(CustomSelectors.GetFeatureSteps(featureId))
      .subscribe(steps => this.setSteps(steps));
    // When steps$ is changed do the rollup of duplicated steps
    this.subs.sink = this.stepsForm.valueChanges
      .pipe(debounceTime(500), distinctUntilChanged())
      .subscribe(stepsArray => this.rollupDuplicateSteps(stepsArray));

    // insert default step if currently viewed feature, is new and still not created
    if (this.feature.feature_id === 0) {
      this.insertDefaultStep();
    }
  }

  /**
   * Custom function to fix or validate each step
   * every time the user loses focus for the given step
   * @param {FocusEvent} event Event of blur
   * @param {number} index Index of step
   */
  fixStep(event: any, index: number) {
    const actionsToValidate = ['StartBrowser and call URL', 'Goto URL'];
    // Get value from textarea input
    let stepValue: string = event.target.value;
    for (const action of actionsToValidate) {
      // Check if current step is of type URL typing
      if (stepValue.startsWith(action)) {
        // Get URL value
        let url = stepValue.match(/\"(.+)\"/);
        // Regex testing for valid URLs
        // from https://www.regextester.com/104035
        const urlRegex =
          /(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#()?&//=]*)/;
        // Check matching URL and is valid
        if (url && url[1] && urlRegex.test(url[1])) {
          // Add http://
          const urlWithProtocol = this.addhttp(url[1]);
          // Replace URL in step value
          stepValue = stepValue.replace(url[1], urlWithProtocol);
          // Update control value and view
          this.stepsForm.at(index).get('step_content').setValue(stepValue);
          this.stepsForm.updateValueAndValidity();
        }
      }
    }
  }

  // maintains focus on text area while firing events on arrow keys to select variables
  onTextareaArrowKey(event: Event, direction: string, step) {
    event.preventDefault();

    setTimeout(() => {
      const varlistItems = this.varlistItems.toArray();

      for (let i = 0; i < varlistItems.length; i++) {
        if (varlistItems[i].nativeElement.classList.contains('selected')) {
          this.renderer.removeClass(varlistItems[i].nativeElement, 'selected');
          direction === 'down'
            ? this.selectnext(varlistItems, i)
            : this.selectPrevious(varlistItems, i);
          return;
        }
      }
    }, 0);
  }

  // based on currently selected item in flyout, when arrowkey up is pressed, selects previous element if it exists
  // if previous element does not exists, in other words the currently selected item is the first one, then arrow key up will scroll down to last element and select it
  selectPrevious(varlistItems: ElementRef[], i: number) {
    if (varlistItems[i - 1]) {
      this.renderer.addClass(varlistItems[i - 1].nativeElement, 'selected');
      this.varlist.nativeElement.scrollTop = (i - 1) * 30;
    } else {
      this.renderer.addClass(
        varlistItems[varlistItems.length - 1].nativeElement,
        'selected'
      );
      this.varlist.nativeElement.scrollTop = (varlistItems.length - 1) * 30;
    }
  }

  // based on currently selected item in flyout, when arrowkey down is pressed, selects next element if it exists
  // if previous element does not exists, in other words the currently selected item is the last one, then arrow key down will scroll up to first element and select it
  selectnext(varlistItems: ElementRef[], i: number) {
    if (varlistItems[i + 1]) {
      this.renderer.addClass(varlistItems[i + 1].nativeElement, 'selected');
      this.varlist.nativeElement.scrollTop = (i + 1) * 30;
    } else {
      this.renderer.addClass(varlistItems[0].nativeElement, 'selected');
      this.varlist.nativeElement.scrollTop = 0;
    }
  }

  // when escape is clicked, prevent parent dialog from closing and removes variable flyout
  onStepEscape(event: Event) {
    event.stopImmediatePropagation();
    this.stepVariableData.currentStepIndex = null;
  }

  // removes variable flyout if clicked target on focusout event is not one of the variables
  onStepFocusOut(event: FocusEvent) {
    event.preventDefault();

    const ev = event as any;
    if (!ev.relatedTarget?.attributes.id)
      this.stepVariableData.currentStepIndex = null;
  }

  // removes variable flyout on current step row, when keydown TAB event is fired
  onTextareaTab(i: number) {
    if (this.stepVariableData.currentStepIndex === i) {
      this.stepVariableData.currentStepIndex = null;
    }
  }

  // inserts variable into step when clicked
  onClickVariable(variable_name: string, index: number) {
    // console.log("Clicado elinput: ", variable_name)
    if (!variable_name) return;

    let step = this.stepsForm.at(index).get('step_content');
    step.setValue(
      step.value.substr(0, this.stepVariableData.quoteIndexes.prev) +
        `$${variable_name}` +
        step.value.substr(this.stepVariableData.quoteIndexes.next - 1)
    );

    this.stepVariableData.currentStepIndex = null;
  }

  // defines logic to be executed when user presses enter key
  onTextareaEnter(event: any, index: number) {
    // if user is currently viewing variables in flyout, disable default behavior of textarea to expand height on enter
    if (this.displayedVariables.length > 0) {
      event.preventDefault();
    }
    // get currently displayed variable list
    const varlistItems = this.varlistItems.toArray();

    // gets the dom element of variable that currently contains class selected, and inserts its value into step
    for (let i = 0; i < varlistItems.length; i++) {
      if (varlistItems[i].nativeElement.classList.contains('selected')) {
        const var_name = varlistItems[i].nativeElement.querySelector(
          '.variable-wrapper .var_name'
        );

        if (var_name) {
          this.onClickVariable(var_name.innerText.replace('$', ''), index);
          this.displayedVariables = [];
        }
        return;
      }
    }

    this.displayedVariables = [];
  }

  onStepChange(event, index: number) {
    this.displayedVariables = [];
    this.stepVariableData = {};

    const textareaValue = (event.target as HTMLTextAreaElement).value.trim();

    if (!textareaValue) {
      this.stepsDocumentation[index] = {
        description: '',
        examples: ''
      };
    }

    this._cdr.detectChanges();

    // sets the index of currently being edited step row
    this.stepVariableData.currentStepIndex = index;

    // gets cursor position on text area
    this.stepVariableData.selectionIndex = event.target.selectionStart;

    // gets whole textarea value
    this.stepVariableData.stepValue = event.target.value as string;

    // gets the position of nearest left $ and right " chars, taking current cursor position as startpoint index
    this.stepVariableData.quoteIndexes = this.getIndexes(
      this.stepVariableData.stepValue,
      this.stepVariableData.selectionIndex
    );

    // return if left quote or right quote index is undefined
    if (
      !this.stepVariableData.quoteIndexes.next ||
      !this.stepVariableData.quoteIndexes.prev
    )
      return;

    // gets the string between quotes(including quotes)
    this.stepVariableData.strToReplace =
      this.stepVariableData.stepValue.substring(
        this.stepVariableData.quoteIndexes.prev,
        this.stepVariableData.quoteIndexes.next
      );

    // removes quotes
    this.stepVariableData.strWithoutQuotes = this.stepVariableData.strToReplace
      .replace(/"/g, '')
      .trim();

    // if the string without quotes contains dollar char, removes it and then the rest of the string is used to filter variables by name
    if (this.stepVariableData.strWithoutQuotes.includes('$')) {
      // const strWithoutDollar = this.stepVariableData.strWithoutQuotes.replace('$','')
      const filteredVariables = this.variables.filter(item =>
        item.variable_name.includes(
          this.stepVariableData.strWithoutQuotes.replace('$', '')
        )
      );
      this.displayedVariables =
        filteredVariables.length > 0
          ? filteredVariables
          : ['No variable with this name'];

      // when flyout of variables opens up, by default the selected element will be the first one
      setTimeout(() => {
        const firstVariableRef = this.varlistItems.toArray()[0].nativeElement;
        this.renderer.addClass(firstVariableRef, 'selected');
      }, 0);
    }

  }

  // returns the index of nearest left $ and nearest right " char in string, taking received startIndex as startpoint reference
  getIndexes(str, startIndex): QuoteIndexes {
    let prevQuoteIndex = getPrev();
    let nextQuoteIndex = getNext();

    // returns the index of the nearest " that is positioned after received index
    function getNext(): number {
      for (let i = startIndex; i < str.length; i++) {
        if (str[i] === '"') return i + 1;
      }
    }

    // returns the index of the nearest $ that is positioned before received index
    function getPrev(): number {
      for (let i = startIndex - 1; i >= 0; i--) {
        if (str[i] === '$') return i;
      }
    }

    return { prev: prevQuoteIndex, next: nextQuoteIndex };
  }

  stepsDocumentation: { description: string, examples: string }[] = [];

  /**
   * Triggered when the user selects a step from the Autocomplete feature
   * @param event MatAutocompleteSelectedEvent
   * @param index Index of the current step
   */
  selectFirstVariable(event: MatAutocompleteSelectedEvent, index: number) {
    // Obtener el valor del paso seleccionado
    const step = event.option.value;

    // Hacer que el paso sea visible en la UI para el índice especificado
    this.stepVisible[index] = true;

    const cleanedStep = step.replace(/Parameters:([\s\S]*?)Example:/gs, '').trim();
    // console.log("Prueba: ", cleanedStep);

    // Usamos una expresión regular para extraer el nombre de la acción y la variable
    const matchResult = step.match(/^(.*?)\s*"(.*?)"/);
    if (matchResult) {
      const actionName = matchResult[1].trim();

      // Buscar la acción correspondiente usando el nombre de la acción
      const activatedAction = this.actions.find(action =>
        action.action_name.split('"')[0].trim() === actionName
      );

      // Acceder al FormGroup específico para este paso en la lista de formularios
      const stepFormGroup = this.stepsForm.at(index) as FormGroup;

      // Actualizar el valor de "step_action" en el FormGroup
      stepFormGroup.patchValue({ step_action: activatedAction.action_name });

      // Actualizar la documentación para este paso
      this.selectedActionTitle = activatedAction.action_name;
      this.selectedActionDescription = activatedAction.description;

      // Limpiar las etiquetas <br> de la descripción
      this.selectedActionDescription = this.selectedActionDescription.replace(/<br\s*\/?>/gi, '');

      // Separar la descripción y los ejemplos si es necesario
      if (this.selectedActionDescription.includes("Example")) {
        const parts = this.selectedActionDescription.split("Example:");
        this.descriptionText = parts[0].trim();
        this.examplesText = parts[1]?.trim() || '';
      } else {
        this.descriptionText = this.selectedActionDescription;
        this.examplesText = '';
      }

      // Almacenar la documentación para el paso actual
      this.stepsDocumentation[index] = {
        description: this.descriptionText,
        examples: this.examplesText
      };

      this._cdr.detectChanges();
    }

    // Obtener el textarea correspondiente y seleccionar el primer parámetro
    const input = this._elementRef.nativeElement.querySelectorAll('textarea.code')[index] as HTMLInputElement;
    const parameterRegex = /\{[a-z\d\-_\s]+\}/i;
    const match = parameterRegex.exec(step);
    if (match) {
      this._ngZone.runOutsideAngular(() =>
        input.setSelectionRange(match.index, match.index + match[0].length)
      );
    }

    this._cdr.detectChanges();
  }


  selectedActionTitle: string = '';
  selectedActionDescription: string = '';
  descriptionText: string = '';
  examplesText: string = '';
  showHideStepDocumentation: boolean = true;

  onOptionActivated(event: MatAutocompleteActivatedEvent, index): void {
    if (event && event.option) {
      const activatedActionName = event.option.value;

      const activatedAction = this.actions.find(action => action.action_name === activatedActionName);
      if (activatedAction) {
        // Asignar los valores de la acción seleccionada
        this.selectedActionTitle = activatedAction.action_name;
        this.selectedActionDescription = activatedAction.description;

        // Limpiar las etiquetas <br> de la descripción
        this.selectedActionDescription = this.selectedActionDescription.replace(/<br\s*\/?>/gi, '');

        // Separar la descripción y los ejemplos si es necesario
        if (this.selectedActionDescription.includes("Example")) {
          const parts = this.selectedActionDescription.split("Example:");

          // Guardar la descripción y ejemplos por separado
          this.descriptionText = parts[0].trim();
          this.examplesText = parts[1]?.trim() || '';

          // console.log("Example text:", this.examplesText);
        } else {
          this.descriptionText = this.selectedActionDescription;
          this.examplesText = '';
        }

        // Aquí puedes agregar la actualización de la documentación para este paso
        // Si tienes un arreglo de `stepsDocumentation`, puedes almacenarlo aquí también
        this.stepsDocumentation[index] = {
          description: this.descriptionText,
          examples: this.examplesText
        };

        this._cdr.detectChanges();
      }
    }
  }


  toggleShowHideDoc() {
    this.showHideStepDocumentation = !this.showHideStepDocumentation
  }

  @ViewChild(MatAutocompleteTrigger) autocompleteTrigger!: MatAutocompleteTrigger;


  // @HostListener('document:keydown', ['$event'])
  // handleKeydown(event: KeyboardEvent): void {
  //   if (event.keyCode === KEY_CODES.ESCAPE) {
  //     this.closeAutocomplete();
  //   }
  // }

  iconPosition = { top: 0, left: 0 };

  focusedIndex: number | null = null;
  stepVisible: boolean[] = [];

  closeAutocomplete(index?: number) {
    // console.log("El evento: ", event.value.step_content)
    // console.log("El index: ", index)
    const stepFormGroup = this.stepsForm.at(index) as FormGroup;
    const stepContent = stepFormGroup.get('step_content')?.value;
    // console.log('Step Content:', stepContent);
    if (stepContent == '') {
      this.stepsDocumentation[index] = {
        description: '',
        examples: ''
      };
    }

    this._cdr.detectChanges();
  }

  isIconActive: { [key: string]: boolean } = {};

  importClipboardStepDoc(stepsDocumentationExample: string) {
    navigator.clipboard.writeText(stepsDocumentationExample).then(() => {
    this.isIconActive[stepsDocumentationExample] = true;
    this._cdr.detectChanges();
    setTimeout(() => {
      this.isIconActive[stepsDocumentationExample] = false;
      this._cdr.detectChanges();
    }, 400);
    this.snack.open('Text copied to clipboard', 'Close');
    }).catch(err => {
      console.error('Error copying: ', err);
      this.snack.open('Error copying text', 'Close');
    });
  }

  isAutocompleteOpened: boolean = false;

  onAutocompleteOpened(index?: number) {
    this.stepVisible[index] = true;
    // console.log("FocusedIndex: ", index)
    this.isAutocompleteOpened = true;

    setTimeout(() => {
      this.updateIconPosition();
    });
  }

  updateIconPosition() {
    const overlayElement = document.querySelector('.cdk-overlay-pane');
    // console.log("Overlay:", overlayElement)
    if (overlayElement) {
      const rect = overlayElement.getBoundingClientRect();
      // console.log("rect:", rect)
      this.iconPosition = {
        top: rect.top,
        left: rect.left + rect.width,
      };
    }
  }


  isTransparent: boolean = false;

  toggleVisibility(): void {
    this.isTransparent = !this.isTransparent;
    if(this.isTransparent) {
      this.onAutocompleteOpened()
    }
  }

  // Automatically adds http:// if URL doesn't contain it
  addhttp(url: string) {
    if (!/^(?:f|ht)tps?\:\/\//.test(url)) {
      url = 'http://' + url;
    }
    return url;
  }

  trackStep = index => index;

  realizedRequests = [];
  async rollupDuplicateSteps(stepsArray: FeatureStep[]) {
    // #2430 - Marks steps as disabled if step is found inside an import
    // First get all import IDs
    const importIds: number[] = stepsArray.reduce((r, step) => {
      const matches = step.step_content.match(/Run feature with id "(\d+)"/);
      if (!!matches) r.push(+matches[1]);
      return r;
    }, []);
    if (importIds.length > 0) {
      // Check if we already have the imports info in our cache
      const needsRequest = importIds
        // #3526 ------------------------------------- start
        .map(id => {
          if (!this.realizedRequests.includes(id)) {
            this.realizedRequests.push(id);
            return this._api.getFeatureSteps(id);
          } else {
            return of([]);
          }
          // #3526 ------------------------------------- end
        });
      // Request those we don't have in our cache
      if (needsRequest.length > 0) {
        const featureSteps = await forkJoin([...needsRequest]).toPromise();
        const importsSteps = this.importsSteps$.getValue();
        // Assign results to local variables
        featureSteps.forEach(steps => {
          if (steps.length > 0) {
            steps.forEach(step => {
              if (!importsSteps.includes(step.step_content))
                importsSteps.push(step.step_content);
            });
          }
        });
        this.importsSteps$.next(importsSteps);
      }
    }
  }

  importsSteps$ = new BehaviorSubject<string[]>([]);

  removeAll() {
    this._dialog
      .open(AreYouSureDialog, {
        data: {
          title: 'translate:you_sure.remove_all_title',
          description: 'translate:you_sure.remove_all',
        } as AreYouSureData,
      })
      .afterClosed()
      .subscribe(exit => {
        // Close edit feature popup
        if (exit) {
          this.stepsForm.clear();
          this._cdr.detectChanges();
        }
      });
  }

  add() {
    const dialogRef = this._dialog.open(AddStepComponent, {
      panelClass: 'add-step-panel',
      autoFocus: true,
      disableClose: true,
      data: {
        templates: false,
      },
    });

    dialogRef.afterOpened().subscribe(() => {
      const addStepInstance = dialogRef.componentInstance;
      if (addStepInstance) {
        addStepInstance.textareaFocus.subscribe((isFocused: boolean) => {
          this.inputFocusService.setInputFocus(isFocused);

        });
      }
    });

    dialogRef.afterClosed().subscribe((res: Action) => {
      if (res) {
        this.stepsForm.push(
          this._fb.group({
            enabled: true,
            screenshot: res.screenshot,
            step_keyword: 'Given',
            compare: res.compare,
            step_content: [
              res.interpreted,
              CustomValidators.StepAction.bind(this),
            ],
            continue_on_failure: false,
            timeout: this.department.settings?.step_timeout ||
              this._fb.control(
                60,
                Validators.compose([
                  Validators.min(1),
                  Validators.max(7205),
                  Validators.maxLength(4),
                ])
              ),
          })
        );
        this._cdr.detectChanges();
        this.focusStep(this.stepsForm.length - 1);
      }
    });
  }


  addEmpty(index: number = null) {
    const template = this._fb.group({
      compare: false,
      screenshot: false,
      step_keyword: 'Given',
      step_content: ['', CustomValidators.StepAction.bind(this)],
      step_action: '',
      enabled: true,
      continue_on_failure: false,
      timeout:
        this.department.settings?.step_timeout ||
        this._fb.control(
          60,
          Validators.compose([
            Validators.min(1),
            Validators.max(7205),
            Validators.maxLength(4),
          ])
        ),
    });
    if (index !== null) {
      this.stepsForm.insert(index, template);
    } else {
      this.stepsForm.push(template);
    }
    this._cdr.detectChanges();
    if (index !== null) {
      this.focusStep(index);
    } else {
      this.focusStep(this.stepsForm.length - 1);
    }
  }

  copyItem(index: number, position: string) {
    const stepToCopy =
      position === 'up'
        ? this.stepsForm.controls[index]
        : this.stepsForm.controls[index - 1];
    // Recreate step, if process is not done, copied steps would be synced by reference
    const newStepToCopy = this._fb.group({
      compare: stepToCopy.value.compare,
      screenshot: stepToCopy.value.screenshot,
      step_keyword: stepToCopy.value.step_keyword,
      step_content: [
        stepToCopy.value.step_content,
        CustomValidators.StepAction.bind(this),
      ],
      step_action: stepToCopy.value.step_action,
      enabled: stepToCopy.value.enabled,
      continue_on_failure: stepToCopy.value.continue_on_failure,
      timeout: stepToCopy.value.timeout,
    });
    this.stepsForm.insert(index, newStepToCopy);

    const stepFormGroup = this.stepsForm.at(index) as FormGroup;

    const stepAction = stepFormGroup.get('step_action')?.value;
    const stepContent = stepFormGroup.get('step_content')?.value;

    const activatedAction = this.actions.find(action =>
      action.action_name === stepAction
    );

    if (activatedAction) {
      // Asignar título y descripción de la acción seleccionada
      this.selectedActionTitle = activatedAction.action_name;
      this.selectedActionDescription = activatedAction.description;

      // Limpiar las etiquetas <br> de la descripción
      this.selectedActionDescription = this.selectedActionDescription.replace(/<br\s*\/?>/gi, '');

      // Separar la descripción y ejemplos si es necesario
      if (this.selectedActionDescription.includes("Example")) {
        const parts = this.selectedActionDescription.split("Example:");
        this.descriptionText = parts[0].trim();
        this.examplesText = parts[1]?.trim() || '';
      } else {
        this.descriptionText = this.selectedActionDescription;
        this.examplesText = '';
      }

      this.stepsDocumentation[index] = {
        description: this.descriptionText,
        examples: this.examplesText
      };
    }
    this._cdr.detectChanges();
  }

  drop(event: CdkDragDrop<string[]>) {
    // if (this.stepVisible.length > 0) {
    //   this.stepVisible = this.stepVisible.map(() => false);
    // } else {
    //   console.warn('stepVisible está vacío');
    // }
    const panel = document.querySelector('.stepContainer');
    if (panel) {
      this.renderer.removeChild(document.body, panel);
      // console.log('Autocomplete panel eliminado');
    }

    const control = this.stepsForm.controls[event.previousIndex];
    this.stepsForm.removeAt(event.previousIndex);
    this.stepsForm.insert(event.currentIndex, control);

    this._cdr.detectChanges();
  }


  deleteStep(i: number) {
    this.stepsForm.removeAt(i);
    this._cdr.detectChanges();
  }

  focusStep(childIndex) {
    setTimeout(_ => {
      try {
        document
          .querySelector(
            `.mat-dialog-content .step-row:nth-child(${childIndex + 1})`
          )
          .scrollIntoView({ block: 'center', behavior: 'smooth' });
        (
          document.querySelector(
            `.mat-dialog-content .step-row:nth-child(${childIndex + 1}) .code`
          ) as HTMLInputElement
        ).focus();
      } catch (err) {}
    }, 0);
  }

  scrollStepsToBottom(focusLastStep: boolean = false) {
    setTimeout(_ => {
      try {
        document
          .querySelector(`.mat-dialog-content .step-row:last-child`)
          .scrollIntoView({ block: 'center', behavior: 'smooth' });
        setTimeout(() => {
          if (focusLastStep) {
            (
              document.querySelector(
                `.mat-dialog-content .step-row:last-child .code`
              ) as HTMLInputElement
            ).focus();
          }
        }, 500);
      } catch (err) {}
    }, 0);
  }

  exportClipboard() {
    if (this._clipboard.copyFromContent(JSON.stringify(this.getSteps()))) {
      this._snackBar.open('Steps copied to clipboard!', 'OK');
    } else {
      this._snackBar.open('Error copying to clipboard.', 'OK');
    }
  }

  export() {
    const steps = this.getSteps();
    if (steps.length > 0) {
      exportToJSONFile(
        this.feature.feature_name || this.name || 'Unnamed',
        this.getSteps()
      );
    } else {
      this._snackBar.open('There are no steps to export', 'OK');
    }
  }

  readJson(e) {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (result: any) => {
      let stepsA: any[];
      try {
        stepsA = JSON.parse(result.target.result);
      } catch (err) {
        this._snackBar.open('Invalid JSON syntax', 'OK');
        return;
      }
      if (Array.isArray(stepsA)) {
        const length = stepsA.length;
        for (let i = 0; i < length; i++) {
          if (!stepsA[i].hasOwnProperty('step_content')) {
            this._snackBar.open('Invalid data properties', 'OK');
            return;
          }
        }
        this.setSteps(stepsA, false);
        (
          document.getElementsByClassName('upload_json')[0] as HTMLInputElement
        ).value = '';
        this._snackBar.open('Successfully imported steps!', 'OK');
      } else {
        this._snackBar.open('Invalid data', 'OK');
        return;
      }
    };
    reader.readAsText(file);
  }

  importClipboard() {
    this.sendTextareaFocusToParent(true);
    const ref = this._dialog.open(ImportJSONComponent);
    ref.afterClosed().subscribe(success => {
      this.sendTextareaFocusToParent(false);
      if (success) {
        let stepsA: any[];
        try {
          stepsA = JSON.parse(ref.componentInstance.json);
        } catch (err) {
          this._snackBar.open('Invalid JSON syntax', 'OK');
          return;
        }
        if (Array.isArray(stepsA)) {
          const length = stepsA.length;
          for (let i = 0; i < length; i++) {
            if (!stepsA[i].hasOwnProperty('step_content')) {
              this._snackBar.open('Invalid data properties', 'OK');
              return;
            }
          }
          this.setSteps(stepsA, false);
          (
            document.getElementsByClassName(
              'upload_json'
            )[0] as HTMLInputElement
          ).value = '';
          this._snackBar.open('Successfully imported steps!', 'OK');
          this.scrollStepsToBottom();
        } else {
          this._snackBar.open('Invalid data', 'OK');
          return;
        }
      }
    });
  }

  screenshotChange(event: MatCheckboxChange, i: number) {
    if (!event.checked) {
      this.stepsForm.at(i).get('compare').setValue(false);
    }
  }

  insertDefaultStep() {
    this.stepsForm.push(
      this._fb.group({
        enabled: true,
        screenshot: false,
        step_keyword: 'Given',
        compare: false,
        step_content: [
          'StartBrowser and call URL "{url}"',
          CustomValidators.StepAction.bind(this),
        ],
        step_action: '',
        continue_on_failure: false,
        timeout:
          this.department.settings?.step_timeout ||
          this._fb.control(
            60,
            Validators.compose([
              Validators.min(1),
              Validators.max(7205),
              Validators.maxLength(4),
            ])
          ),
      })
    );
  }

  insertStep(event: KeyboardEvent, i: number){
    event.preventDefault();
    if(event.key == 'ArrowDown'){
      this.addEmpty(i+1);
    }
    else if (event.key == 'ArrowUp'){
      this.addEmpty(i);
    }
  }

  copyStep(event: KeyboardEvent, i: number){
    event.preventDefault();
    if(event.key == 'ArrowDown'){
      this.copyItem(i+1, 'down');
    }
    else if (event.key == 'ArrowUp'){
      this.copyItem(i, 'up');
    }
  }

}
