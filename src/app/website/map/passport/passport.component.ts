import { Component, ElementRef, ViewChild, AfterViewInit, Input, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';

interface PassportData {
  label: string;
  value: string;
}

@Component({
  selector: 'app-passport',
  templateUrl: './passport.component.html',
  styleUrls: ['./passport.component.scss']
})
export class PassportComponent implements AfterViewInit, OnInit, OnDestroy {
  @ViewChild('passportBlock') passportBlock!: ElementRef<HTMLDivElement>;
  @ViewChild('leftColumn') leftColumn!: ElementRef<HTMLDivElement>;

  @Input() objectData: any;
  @Input() objectType: 'well' | 'pipe' | 'pipe-segment' | 'user' | 'capture' | 'pump' | 'reservoir' | 'tower' | null = null;
  @Input() objectId: number | null = null;
  @Output() passportClosed = new EventEmitter<number>(); // Emit objectId when closed

  passportData: PassportData[] = [];
  objectName: string = 'Объект';
  visiblePassportData: PassportData[] = [];
  isMinimized: boolean = false;
  originalZIndex: string = '1000';
  originalHeight: string = '160px';

  private static minimizedOrder: number[] = [];
  private static lastActivePassportId: number | null = null;

  private isDragging = false;
  private isResizingColumn = false;
  private isResizingWidth = false;
  private isResizingHeight = false;
  private isFixed = false;
  private startX = 0;
  private startY = 0;
  private startWidth = 0;
  private startHeight = 0;
  private previousLeft = '10px';
  private previousTop = '10px';
  private previousHeight = '160px';
  private previousWidth = '450px';
  private previousZIndex = '1000';
  private previousContainerStyles: Partial<CSSStyleDeclaration> = {};
  private wasMinimizedDuringFix: boolean = false;

  editMode: boolean = false;
  editFields: { [key: string]: any } = {};
  fieldTypes: { [key: string]: 'string' | 'number' } = {};
  editableKeys: string[] = [];

  ngOnInit() {
    if (this.objectType === 'well') {
      this.objectName = `Скважина #${this.objectData.id || 1}`;
      this.passportData = [
        { label: 'ID', value: (this.objectData.id || 1).toString() },
        { label: 'Координаты', value: `[${(this.objectData.position ? this.objectData.position[0] : 54.406709)}, ${(this.objectData.position ? this.objectData.position[1] : 50.793813)}]` },
        { label: 'Тип', value: 'Скважина' },
        { label: 'Адрес', value: this.objectData.address || '' },
        { label: 'Глубина', value: this.objectData.depth != null ? this.objectData.depth : '' },
        { label: 'Диаметр', value: this.objectData.diameter != null ? this.objectData.diameter : '' },
        { label: 'Имя', value: this.objectData.name || '' },
      ];
      this.editableKeys = ['Адрес', 'Глубина', 'Диаметр', 'Имя'];
      this.fieldTypes = { 'Адрес': 'string', 'Глубина': 'number', 'Диаметр': 'number', 'Имя': 'string' };
    } else if (this.objectType === 'pipe') {
      this.objectName = `Труба #${this.objectData.id}`;
      this.passportData = [
        { label: 'ID', value: this.objectData.id.toString() },
        { label: 'Вершины', value: this.objectData.vertices.length.toString() },
        { label: 'Потребители', value: this.objectData.userConnections.length.toString() },
        { label: 'Диаметр', value: this.objectData.diameter ? this.objectData.diameter.toString() + ' мм' : '' },
        { label: 'Тип', value: this.objectData.type || 'Труба' },
      ];
      this.editableKeys = ['Диаметр', 'Тип'];
      this.fieldTypes = { 'Диаметр': 'number', 'Тип': 'string' };
    } else if (this.objectType === 'pipe-segment') {
      this.objectName = `Отрезок трубы #${this.objectData.pipeId}`;
      const from = this.objectData.from;
      const to = this.objectData.to;
      const fromIndex = this.objectData.fromIndex;
      const toIndex = this.objectData.toIndex;
      const length = this.calculateSegmentLength(from, to);
      this.passportData = [
        { label: 'ID трубы', value: this.objectData.pipeId.toString() },
        { label: 'Вершина 1 (индекс)', value: `${fromIndex} [${from[0]}, ${from[1]}]` },
        { label: 'Вершина 2 (индекс)', value: `${toIndex} [${to[0]}, ${to[1]}]` },
        { label: 'Длина отрезка', value: length.toFixed(2) },
        { label: 'Тип', value: 'Отрезок трубы' },
      ];
      this.editableKeys = ['Длина отрезка', 'Тип'];
      this.fieldTypes = { 'Длина отрезка': 'number', 'Тип': 'string' };
    } else if (this.objectType === 'user') {
      this.objectName = `Потребитель #${this.objectData.id || 1}`;
      this.passportData = [
        { label: 'ID', value: (this.objectData.id || 1).toString() },
        { label: 'Координаты', value: `[${(this.objectData.position ? this.objectData.position[0] : 54.406709)}, ${(this.objectData.position ? this.objectData.position[1] : 50.793813)}]` },
        { label: 'Тип', value: 'Потребитель' },
        { label: 'Адрес', value: this.objectData.address || '' },
        { label: 'Геодезическая отметка', value: this.objectData.geodeticMark != null ? this.objectData.geodeticMark : '' },
        { label: 'Диаметр выходного отверстия', value: this.objectData.outletDiameter != null ? this.objectData.outletDiameter : '' },
        { label: 'Имя', value: this.objectData.name || '' },
        { label: 'Категория', value: this.objectData.category || '' },
        { label: 'Минимальный напор воды', value: this.objectData.minPressure != null ? this.objectData.minPressure : '' },
        { label: 'Напор', value: this.objectData.pressure != null ? this.objectData.pressure : '' },
        { label: 'Относительный расход воды', value: this.objectData.relativeFlow != null ? this.objectData.relativeFlow : '' },
        { label: 'Полный напор', value: this.objectData.fullPressure != null ? this.objectData.fullPressure : '' },
        { label: 'Расчетный расход воды в будний день', value: this.objectData.flowWeekday != null ? this.objectData.flowWeekday : '' },
        { label: 'Расчетный расход воды в воскресенье', value: this.objectData.flowSunday != null ? this.objectData.flowSunday : '' },
        { label: 'Расчетный расход воды в праздники', value: this.objectData.flowHoliday != null ? this.objectData.flowHoliday : '' },
        { label: 'Расчетный расход воды в субботу', value: this.objectData.flowSaturday != null ? this.objectData.flowSaturday : '' },
        { label: 'Расчётный расход воды', value: this.objectData.flowCalculated != null ? this.objectData.flowCalculated : '' },
        { label: 'Способ задания потребителя', value: this.objectData.userMethod || '' },
        { label: 'Текущий расход воды', value: this.objectData.currentFlow != null ? this.objectData.currentFlow : '' },
        { label: 'Уровень воды', value: this.objectData.waterLevel != null ? this.objectData.waterLevel : '' },
      ];
      this.editableKeys = [
        'Адрес', 'Геодезическая отметка', 'Диаметр выходного отверстия', 'Имя', 'Категория',
        'Минимальный напор воды', 'Напор', 'Относительный расход воды', 'Полный напор',
        'Расчетный расход воды в будний день', 'Расчетный расход воды в воскресенье',
        'Расчетный расход воды в праздники', 'Расчетный расход воды в субботу',
        'Расчётный расход воды', 'Способ задания потребителя', 'Текущий расход воды', 'Уровень воды'
      ];
      this.fieldTypes = {
        'Адрес': 'string', 'Геодезическая отметка': 'number', 'Диаметр выходного отверстия': 'number', 'Имя': 'string',
        'Категория': 'string', 'Минимальный напор воды': 'number', 'Напор': 'number', 'Относительный расход воды': 'number',
        'Полный напор': 'number', 'Расчетный расход воды в будний день': 'number', 'Расчетный расход воды в воскресенье': 'number',
        'Расчетный расход воды в праздники': 'number', 'Расчетный расход воды в субботу': 'number', 'Расчётный расход воды': 'number',
        'Способ задания потребителя': 'string', 'Текущий расход воды': 'number', 'Уровень воды': 'number'
      };
    } else if (this.objectType === 'capture' || this.objectType === 'pump' || this.objectType === 'reservoir' || this.objectType === 'tower') {
      this.objectName = `${this.objectType} #${this.objectData.id}`;
      this.passportData = [
        { label: 'Тип', value: this.objectType },
        { label: 'ID', value: this.objectData.id?.toString() || '' },
        { label: 'Координаты', value: this.objectData.position ? this.objectData.position.join(', ') : '' },
      ];
      this.editableKeys = ['Тип', 'ID', 'Координаты'];
      this.fieldTypes = { 'Тип': 'string', 'ID': 'number', 'Координаты': 'string' };
    }
    this.passportData.forEach(item => {
      this.editFields[item.label] = item.value;
    });
    this.visiblePassportData = [...this.passportData];

    this.originalZIndex = `${1000 + (this.objectId || 0)}`;
    this.originalHeight = `${this.calculateMaxHeight()}px`;
    console.log(`ngOnInit: objectId=${this.objectId}, objectName=${this.objectName}, objectType=${this.objectType}, originalZIndex=${this.originalZIndex}, originalHeight=${this.originalHeight}`);
  }

  ngAfterViewInit() {
    this.updatePassportHeight();
    this.updateVisibleRows();
    this.passportBlock.nativeElement.style.left = `${10 + (this.objectId || 0) * 20}px`;
    this.passportBlock.nativeElement.style.top = `${10 + (this.objectId || 0) * 20}px`;
    this.passportBlock.nativeElement.style.zIndex = this.originalZIndex;
    console.log(`ngAfterViewInit: objectId=${this.objectId}, initial left=${this.passportBlock.nativeElement.style.left}, top=${this.passportBlock.nativeElement.style.top}, zIndex=${this.passportBlock.nativeElement.style.zIndex}, data-object-id=${this.passportBlock.nativeElement.dataset['objectId']}`);

    document.addEventListener('click', this.handleDocumentClick);
  }
  

  ngOnDestroy() {
    document.removeEventListener('click', this.handleDocumentClick);
    if (this.isMinimized && this.objectId !== null && !isNaN(this.objectId)) {
      PassportComponent.minimizedOrder = PassportComponent.minimizedOrder.filter(id => id !== this.objectId);
      this.updateMinimizedPositions();
      console.log(`ngOnDestroy: Removed objectId=${this.objectId} from minimizedOrder, new minimizedOrder=`, PassportComponent.minimizedOrder);
    }
    if (PassportComponent.lastActivePassportId === this.objectId) {
      PassportComponent.lastActivePassportId = null;
    }
    console.log(`ngOnDestroy: Passport destroyed, objectId=${this.objectId}`);
  }

  onPassportClick(event: MouseEvent) {
    if (!this.isMinimized) return;
    event.stopPropagation();

    const passport = this.passportBlock.nativeElement;
    const allPassports = document.querySelectorAll('.passport-block') as NodeListOf<HTMLElement>;
    let maxZIndex = 1000;
    allPassports.forEach((p) => {
      const z = parseInt(p.style.zIndex || '1000', 10);
      if (z > maxZIndex) maxZIndex = z;
    });

    // Restore z-index of previous active passport
    if (PassportComponent.lastActivePassportId !== null && PassportComponent.lastActivePassportId !== this.objectId) {
      const prevPassport = Array.from(allPassports).find(p => p.dataset['objectId'] === PassportComponent.lastActivePassportId?.toString());
      if (prevPassport && PassportComponent.minimizedOrder.includes(PassportComponent.lastActivePassportId)) {
        const index = PassportComponent.minimizedOrder.indexOf(PassportComponent.lastActivePassportId);
        const originalZ = 1000 + index;
        prevPassport.style.zIndex = `${originalZ}`;
        console.log(`onPassportClick: Restored zIndex of previous active passport id=${PassportComponent.lastActivePassportId} to ${originalZ}`);
      }
    }

    // Set new z-index for current passport
    passport.style.zIndex = `${maxZIndex + 1}`;
    PassportComponent.lastActivePassportId = this.objectId;
    console.log(`onPassportClick: objectId=${this.objectId}, new zIndex=${passport.style.zIndex}, lastActivePassportId=${PassportComponent.lastActivePassportId}`);
  }

  private handleDocumentClick = (event: MouseEvent) => {
    const passport = this.passportBlock.nativeElement;
    const target = event.target as Node;

    if (this.isMinimized && !passport.contains(target)) {
      if (this.objectId === PassportComponent.lastActivePassportId && this.objectId !== null && PassportComponent.minimizedOrder.includes(this.objectId)) {
        const index = PassportComponent.minimizedOrder.indexOf(this.objectId);
        passport.style.zIndex = `${1000 + index}`;
        PassportComponent.lastActivePassportId = null;
        console.log(`handleDocumentClick: Restored zIndex of objectId=${this.objectId} to ${passport.style.zIndex}, lastActivePassportId=${PassportComponent.lastActivePassportId}`);
      }
    }
  };

  toggleMinimize(event?: MouseEvent) {
    event?.stopPropagation();
    console.log(`toggleMinimize: objectId=${this.objectId}, current isMinimized=${this.isMinimized}, minimizedOrder before=`, PassportComponent.minimizedOrder);
    this.isMinimized = !this.isMinimized;
    const passport = this.passportBlock.nativeElement;
    const container = document.querySelector('.passport-container') as HTMLElement;
    const containerRect = container?.getBoundingClientRect() || { height: 0 };

    if (this.isMinimized) {
      this.previousLeft = passport.style.left || '10px';
      this.previousTop = passport.style.top || '10px';
      this.previousHeight = passport.style.height || this.originalHeight;
      this.previousWidth = passport.style.width || '450px';
      this.previousZIndex = passport.style.zIndex || this.originalZIndex;

      if (this.objectId !== null && !isNaN(this.objectId)) {
        PassportComponent.minimizedOrder = [...PassportComponent.minimizedOrder.filter(id => id !== this.objectId), this.objectId];
      } else {
        console.warn(`toggleMinimize: Invalid objectId=${this.objectId}, not adding to minimizedOrder`);
      }

      passport.style.width = '300px';
      passport.style.height = '30px';
      const index = this.objectId !== null && !isNaN(this.objectId) ? PassportComponent.minimizedOrder.indexOf(this.objectId) : -1;
      const leftOffset = index >= 0 ? 10 + index * 200 : 10;
      passport.style.left = `${leftOffset}px`;
      passport.style.top = containerRect.height ? `${containerRect.height - 40}px` : 'auto';
      passport.style.bottom = 'auto';
      passport.style.zIndex = `${1000 + index}`;

      if (this.isFixed) {
        this.wasMinimizedDuringFix = true;
      }

      this.updateMinimizedPositions();

      console.log(`Minimized: objectId=${this.objectId}, index=${index}, left=${leftOffset}px, top=${containerRect.height - 40}px, zIndex=${passport.style.zIndex}, styles=${passport.style.cssText}, minimizedOrder=`, PassportComponent.minimizedOrder);
    } else {
      if (this.objectId !== null && !isNaN(this.objectId)) {
        PassportComponent.minimizedOrder = PassportComponent.minimizedOrder.filter(id => id !== this.objectId);
      } else {
        console.warn(`toggleMinimize: Invalid objectId=${this.objectId}, not removing from minimizedOrder`);
      }

      const allPassports = document.querySelectorAll('.passport-block') as NodeListOf<HTMLElement>;
      let maxZIndex = 1000;
      allPassports.forEach((p) => {
        const z = parseInt(p.style.zIndex || '1000', 10);
        if (z > maxZIndex) maxZIndex = z;
      });

      passport.style.width = this.previousWidth;
      passport.style.height = this.previousHeight;
      passport.style.left = this.previousLeft;
      passport.style.top = this.previousTop;
      passport.style.bottom = 'auto';
      passport.style.zIndex = `${maxZIndex + 1}`;
      this.updateVisibleRows();

      if (this.objectId === PassportComponent.lastActivePassportId) {
        PassportComponent.lastActivePassportId = null;
      }

      this.updateMinimizedPositions();

      console.log(`Maximized: objectId=${this.objectId}, styles=${passport.style.cssText}, zIndex=${passport.style.zIndex}, minimizedOrder=`, PassportComponent.minimizedOrder);
    }
  }

  private updateMinimizedPositions() {
    console.log('updateMinimizedPositions: Starting, minimizedOrder=', PassportComponent.minimizedOrder);
    const container = document.querySelector('.passport-container') as HTMLElement;
    if (!container) {
      console.error('updateMinimizedPositions: .passport-container not found');
      return;
    }
    const containerRect = container.getBoundingClientRect();
    const allPassports = document.querySelectorAll('.passport-block') as NodeListOf<HTMLElement>;

    setTimeout(() => {
      allPassports.forEach((p, idx) => {
        const rawId = p.dataset['objectId'];
        const id = rawId && !isNaN(parseInt(rawId, 10)) ? parseInt(rawId, 10) : null;
        const isMinimized = p.classList.contains('minimized');
        console.log(`updateMinimizedPositions: passport[${idx}] rawId=${rawId}, id=${id}, isMinimized=${isMinimized}, in minimizedOrder=${id !== null && PassportComponent.minimizedOrder.includes(id)}`);

        if (id !== null && isMinimized && PassportComponent.minimizedOrder.includes(id)) {
          const index = PassportComponent.minimizedOrder.indexOf(id);
          const leftOffset = 10 + index * 200;
          const zIndex = 1000 + index;
          p.style.left = `${leftOffset}px`;
          p.style.top = `${containerRect.height - 40}px`;
          p.style.zIndex = `${zIndex}`;
          console.log(`updateMinimizedPositions: Set passport id=${id} to left=${leftOffset}px, top=${containerRect.height - 40}px, zIndex=${zIndex}, index=${index}`);
        } else {
          console.log(`updateMinimizedPositions: Skipping passport id=${id}, reason: ${id === null ? 'invalid id' : !isMinimized ? 'not minimized' : 'not in minimizedOrder'}`);
        }
      });
      console.log('updateMinimizedPositions: Completed');
    }, 0);
  }

  closePassport() {
    if (this.objectId !== null && !isNaN(this.objectId)) {
      PassportComponent.minimizedOrder = PassportComponent.minimizedOrder.filter(id => id !== this.objectId);
      this.passportClosed.emit(this.objectId); // Notify parent to remove from passports
      this.updateMinimizedPositions();
      console.log(`closePassport: Removed objectId=${this.objectId} from minimizedOrder, emitted passportClosed, new minimizedOrder=`, PassportComponent.minimizedOrder);
    } else {
      console.warn(`closePassport: Invalid objectId=${this.objectId}, not removing from minimizedOrder or emitting event`);
    }
    if (this.objectId === PassportComponent.lastActivePassportId) {
      PassportComponent.lastActivePassportId = null;
    }
    this.passportBlock.nativeElement.remove();
  }

  startDragging(event: MouseEvent) {
    if (this.isFixed || this.isMinimized) return;
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
    const passport = this.passportBlock.nativeElement;
    const rect = passport.getBoundingClientRect();
    this.startX = event.clientX - parseFloat(passport.style.left || '0');
    this.startY = event.clientY - parseFloat(passport.style.top || '0');
    if (!this.isFixed) {
      this.previousLeft = passport.style.left || '10px';
      this.previousTop = passport.style.top || '10px';
    }
    document.addEventListener('mousemove', this.onDrag);
    document.addEventListener('mouseup', this.stopDragging);
  }

  private onDrag = (event: MouseEvent) => {
    if (!this.isDragging) return;
    const container = document.querySelector('.passport-container') as HTMLElement;
    const containerRect = container.getBoundingClientRect();
    const passport = this.passportBlock.nativeElement;
    const passportRect = passport.getBoundingClientRect();

    let newLeft = event.clientX - this.startX;
    let newTop = event.clientY - this.startY;

    newLeft = Math.max(0, Math.min(newLeft, containerRect.width - passportRect.width));
    newTop = Math.max(0, Math.min(newTop, containerRect.height - passportRect.height));

    passport.style.left = `${newLeft}px`;
    passport.style.top = `${newTop}px`;
  };

  private stopDragging = () => {
    this.isDragging = false;
    document.removeEventListener('mousemove', this.onDrag);
    document.removeEventListener('mouseup', this.stopDragging);
  };

  startResizingColumn(event: MouseEvent) {
    if (this.isMinimized) return;
    event.preventDefault();
    this.isResizingColumn = true;
    this.startX = event.clientX;
    this.startWidth = this.leftColumn.nativeElement.offsetWidth;
    document.addEventListener('mousemove', this.onResizeColumn);
    document.addEventListener('mouseup', this.stopResizingColumn);
  }

  private onResizeColumn = (event: MouseEvent) => {
    if (!this.isResizingColumn) return;
    const deltaX = event.clientX - this.startX;
    const passportWidth = this.passportBlock.nativeElement.offsetWidth;
    const minRightColumnWidth = 100;
    const maxLeftColumnWidth = passportWidth - minRightColumnWidth - 1;
    const newWidth = Math.max(200, Math.min(maxLeftColumnWidth, this.startWidth + deltaX));
    this.leftColumn.nativeElement.style.width = `${newWidth}px`;
  };

  private stopResizingColumn = () => {
    this.isResizingColumn = false;
    document.removeEventListener('mousemove', this.onResizeColumn);
    document.removeEventListener('mouseup', this.stopResizingColumn);
  };

  startResizingWidth(event: MouseEvent) {
    if (this.isFixed || this.isMinimized) return;
    event.preventDefault();
    this.isResizingWidth = true;
    this.startX = event.clientX;
    this.startWidth = this.passportBlock.nativeElement.offsetWidth;
    if (!this.isFixed) {
      this.previousLeft = this.passportBlock.nativeElement.style.left || '10px';
    }
    document.addEventListener('mousemove', this.onResizeWidth);
    document.addEventListener('mouseup', this.stopResizingWidth);
  };

  private onResizeWidth = (event: MouseEvent) => {
    if (!this.isResizingWidth) return;
    const deltaX = event.clientX - this.startX;
    const newWidth = Math.max(300, Math.min(600, this.startWidth + deltaX));
    this.passportBlock.nativeElement.style.width = `${newWidth}px`;
    if (this.isFixed) {
      const container = document.querySelector('.passport-container') as HTMLElement;
      const containerRect = container.getBoundingClientRect();
      const passportRect = this.passportBlock.nativeElement.getBoundingClientRect();
      const newLeft = containerRect.width - passportRect.width;
      this.passportBlock.nativeElement.style.left = `${newLeft}px`;
    }
  };

  private stopResizingWidth = () => {
    this.isResizingWidth = false;
    document.removeEventListener('mousemove', this.onResizeWidth);
    document.removeEventListener('mouseup', this.stopResizingWidth);
  };

  startResizingHeight(event: MouseEvent) {
    if (this.isFixed || this.isMinimized) return;
    event.preventDefault();
    this.isResizingHeight = true;
    this.startY = event.clientY;
    this.startHeight = this.passportBlock.nativeElement.offsetHeight;
    if (!this.isFixed) {
      this.previousHeight = this.passportBlock.nativeElement.style.height || this.originalHeight;
    }
    document.addEventListener('mousemove', this.onResizeHeight);
    document.addEventListener('mouseup', this.stopResizingHeight);
  };

  private onResizeHeight = (event: MouseEvent) => {
    if (!this.isResizingHeight) return;
    const deltaY = event.clientY - this.startY;
    const maxHeight = this.calculateMaxHeight();
    const newHeight = Math.max(75, Math.min(maxHeight, this.startHeight + deltaY));
    this.passportBlock.nativeElement.style.height = `${newHeight}px`;
    this.updateVisibleRows();
  };

  private stopResizingHeight = () => {
    this.isResizingHeight = false;
    document.removeEventListener('mousemove', this.onResizeHeight);
    document.removeEventListener('mouseup', this.stopResizingHeight);
  };

  toggleFixPassport() {
    if (this.isMinimized) return;
    const passport = this.passportBlock.nativeElement;
    const container = document.querySelector('.passport-container') as HTMLElement;
    const containerRect = container.getBoundingClientRect();

    if (!this.isFixed) {
      this.previousLeft = passport.style.left || '10px';
      this.previousTop = passport.style.top || '10px';
      this.previousHeight = passport.style.height || this.originalHeight;
      this.previousWidth = passport.style.width || '450px';
      this.previousZIndex = passport.style.zIndex || this.originalZIndex;

      this.previousContainerStyles = {
        top: container.style.top,
        left: container.style.left,
        width: container.style.width,
        height: container.style.height,
        maxHeight: container.style.maxHeight
      };

      container.style.top = '0';
      container.style.left = '0';
      container.style.width = '100%';
      container.style.height = 'calc(100vh - 130px)';
      container.style.maxHeight = '100%';

      passport.style.width = '500px';
      const newHeight = containerRect.height;
      passport.style.height = `${newHeight}px`;
      const passportRect = passport.getBoundingClientRect();
      const newLeft = containerRect.width - passportRect.width;
      passport.style.left = `${newLeft + 20}px`;
      passport.style.top = '10px';
      passport.style.right = '0px';

      const allPassports = document.querySelectorAll('.passport-block') as NodeListOf<HTMLElement>;
      let maxZIndex = 1000;
      allPassports.forEach((p) => {
        const z = parseInt(p.style.zIndex || '1000', 10);
        if (z > maxZIndex) maxZIndex = z;
      });
      passport.style.zIndex = `${maxZIndex + 1}`;

      this.isFixed = true;
      this.wasMinimizedDuringFix = false;
    } else {
      container.style.top = this.previousContainerStyles.top || '10px';
      container.style.left = this.previousContainerStyles.left || '10px';
      container.style.width = this.previousContainerStyles.width || 'calc(100% - 20px)';
      container.style.height = this.previousContainerStyles.height || 'calc(100vh - 140px)';
      container.style.maxHeight = this.previousContainerStyles.maxHeight || 'calc(100% - 20px)';

      passport.style.width = this.previousWidth;
      passport.style.height = this.wasMinimizedDuringFix ? this.originalHeight : this.previousHeight;
      passport.style.left = this.previousLeft;
      passport.style.top = this.previousTop;
      passport.style.zIndex = this.previousZIndex;
      this.isFixed = false;
      this.wasMinimizedDuringFix = false;

      this.updatePassportHeight();
    }

    this.updateVisibleRows();
  }

  private calculateMaxHeight(): number {
    const headerHeight = 20;
    const footerHeight = 20;
    const rowHeight = 22;
    const padding = 10;
    const rows = this.passportData.length;
    return headerHeight + footerHeight + rows * rowHeight + padding;
  }

  private updatePassportHeight() {
    if (this.isMinimized) return;
    const maxHeight = this.calculateMaxHeight();
    const currentHeight = this.passportBlock.nativeElement.offsetHeight;
    if (currentHeight > maxHeight && !this.isFixed) {
      this.passportBlock.nativeElement.style.height = `${maxHeight}px`;
    }
    this.updateVisibleRows();
  }

  private updateVisibleRows() {
    if (this.isMinimized) return;
    const passportHeight = this.passportBlock.nativeElement.offsetHeight;
    const headerHeight = 20;
    const footerHeight = 20;
    const padding = 10;
    const rowHeight = 22;

    const availableHeight = passportHeight - headerHeight - footerHeight - padding;
    const maxVisibleRows = Math.floor(availableHeight / rowHeight);

    this.visiblePassportData = this.passportData.slice(0, maxVisibleRows);
  }

  private calculateSegmentLength(from: [number, number], to: [number, number]): number {
    // Евклидова длина
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    return Math.sqrt(dx * dx + dy * dy);
  }

  onEdit() {
    this.editMode = true;
  }

  onSave() {
    this.visiblePassportData.forEach(item => {
      if (this.editableKeys.includes(item.label)) {
        let val = this.editFields[item.label];
        if (this.fieldTypes[item.label] === 'number') {
          val = val === '' || val === '-' ? 0 : parseFloat(val);
        } else {
          val = val === '' ? '-' : val;
        }
        this.objectData[this.labelToKey(item.label)] = val;
        item.value = val;
      }
    });
    this.editMode = false;
  }

  onCancel() {
    this.passportData.forEach(item => {
      this.editFields[item.label] = item.value;
    });
    this.editMode = false;
  }

  labelToKey(label: string): string {
    const map: { [key: string]: string } = {
      'ID': 'id',
      'Координаты': 'position',
      'Тип': 'type',
      'Адрес': 'address',
      'Глубина': 'depth',
      'Диаметр': 'diameter',
      'Имя': 'name',
      'Геодезическая отметка': 'geodeticMark',
      'Диаметр выходного отверстия': 'outletDiameter',
      'Категория': 'category',
      'Минимальный напор воды': 'minPressure',
      'Напор': 'pressure',
      'Относительный расход воды': 'relativeFlow',
      'Полный напор': 'fullPressure',
      'Расчетный расход воды в будний день': 'flowWeekday',
      'Расчетный расход воды в воскресенье': 'flowSunday',
      'Расчетный расход воды в праздники': 'flowHoliday',
      'Расчетный расход воды в субботу': 'flowSaturday',
      'Расчётный расход воды': 'flowCalculated',
      'Способ задания потребителя': 'userMethod',
      'Текущий расход воды': 'currentFlow',
      'Уровень воды': 'waterLevel',
    };
    return map[label] || label;
  }

  getFields(): { label: string; value: string }[] {
    if (this.objectType === 'capture' || this.objectType === 'pump' || this.objectType === 'reservoir' || this.objectType === 'tower') {
      return [
        { label: 'Тип', value: this.objectType },
        { label: 'ID', value: this.objectData.id?.toString() || '' },
        { label: 'Координаты', value: this.objectData.position ? this.objectData.position.join(', ') : '' },
      ];
    }
    return this.passportData;
  }
}