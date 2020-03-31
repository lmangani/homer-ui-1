import { Component, Input, Output, ViewChild, EventEmitter } from '@angular/core';
import { Widget, WidgetArrayInstance } from '@app/helpers/widget';
import { IWidget } from '../IWidget';
import { trigger, state, style, animate, transition } from '@angular/animations';
import { SettingPcapImportWidgetComponent } from './setting-pcap-import-widget.component';
import { MatDialog } from '@angular/material/dialog';
import { DashboardService  } from '@app/services';
import { Subscription, of} from 'rxjs';
import { ConstValue } from '@app/models';
import { Functions } from '@app/helpers/functions';
import { HttpClient, HttpResponse, HttpRequest, HttpEventType, HttpErrorResponse } from '@angular/common/http';
import { catchError, last, map, tap } from 'rxjs/operators';
export class FileUploadModel {
    data: File;
    state: string;
    inProgress: boolean;
    progress: number;
    canRetry: boolean;
    canCancel: boolean;
    sub?: Subscription;
}

@Component({
    selector: 'app-pcap-import',
    templateUrl: './pcap-import-widget.component.html',
    styleUrls: ['./pcap-import-widget.component.scss'],
    animations: [
        trigger('fadeInOut', [
              state('in', style({ opacity: 100 })),
              transition('* => void', [
                    animate(300, style({ opacity: 0 }))
              ])
        ])
  ]
  })
  
  @Widget({
    title: 'Import PCAP',
    description: 'Import PCAP files into HOMER',
    category: 'Import',
    indexName: 'pcap-import',
    className: 'PcapImportWidgetComponent' // <-- the same name as class name
  })
  
  export class PcapImportWidgetComponent implements IWidget {
 
    @Input() id: string;
    @Input() config: any;
    @Output() changeSettings = new EventEmitter < any > ();
      /** Link text */
    @Input() text = 'Upload';
      /** Name used in form which will be sent in HTTP request. */
    @Input() param = 'file';
      /** Target URL for file uploading. */
    @Input() target = 'https://file.io';
      /** File extension that accepted, same as 'accept' of <input type="file" />. 
          By the default, it's set to 'image/*'. */
    @Input() accept = 'pcap/*';
      /** Allow you to add handler after its completion. Bubble up response text from remote. */
    @Output() complete = new EventEmitter<string>();
    
    maxfileSize = 50000;

    vizHosts = '' //etherframes.length
    vizFrames = '' // ipv4hosts.length
    /* props of handleFileSelect */
    file;
    tate = 0;
    fileposition = 0;
    ts_sec = 0;
    ts_usec = 0;
    ts_firstether = -1;
    frame = 0;
   ipv4hosts = [];
    etherframes = [];
    /*end props of handleFileSelect */


    /* logging props */
    filesLog = {
      maxfileSize:0,
      files: [],
      total:0,
      success: 0,
      error:0
    };

    fileLog = {
      message:'',
      filename: '',
      fileSize: 0,
    }



    private files = [] //Array<FileUploadModel> = [];

    title: any;
    subsDashboardEvent: Subscription;
    _lastTimeStamp = 0;
    set lastTimestamp(val: number) {
      this._lastTimeStamp = val;
    }
    get lastTimestamp() {
      return this._lastTimeStamp;
    }
    localData: any; 

    constructor(
        public dialog: MatDialog,
        private _dashboardService : DashboardService,
        private _http: HttpClient
    
       
        ) { }

/** PCAP to hep Upload methods */
// Ref: https://github.com/lmangani/pcap2hep
// process packet must be part of the api because of js native methods
// @ TODO: import the proxy handlers as services
/** Error handlers */
errorHandler( evt ):any {
  switch ( evt.target.error.code )
  {
  case evt.target.error.NOT_FOUND_ERR:
    alert( 'File Not Found!' );
    break;
  case evt.target.error.NOT_READABLE_ERR:
    alert( 'File is not readable' );
    break;
  case evt.target.error.ABORT_ERR:
    break; // noop
  default:
    alert( 'An error occurred reading this file.' );
  };
}

fileAbortHandler (e):any {
  e.preventDefault();
  alert( 'File read cancelled' );
}
toHex( d )
{
  return ( "0" + ( Number( d ).toString( 16 ) ) ).slice( -2 ).toUpperCase()
}

/** File handlers */

handleFileSelect(e) {

  let files = e.target.files; // FileList object
  let reader: FileReader = new FileReader()
  reader.onerror = this.errorHandler(e);
  // TODO: map onabort event stoping the file list
  reader.onabort = this.fileAbortHandler(e);
  // *fileProcessor method

  let file = files[ 0 ];
  let  blob = file.slice( this.fileposition, this.fileposition + 24 );
  this.fileposition += 24;
  reader.readAsArrayBuffer( blob );
// TODO: next => add this to the onClick.fileUpload.onchange
}

fileProcessor(e){
  
}

/**   end pcap methods */ 


onClick() {
    const fileUpload = document.getElementById('fileUpload') as HTMLInputElement;
    fileUpload.onchange = (e) => {
      console.log(fileUpload)
      this.filesLog.maxfileSize = this.maxfileSize;
          for (let index = 0; index < fileUpload.files.length; index++) {
                const file = fileUpload.files[index];
                const log = {...this.fileLog}
                log.filename = file.name;
                log.fileSize = file.size;
                
                if(this.maxfileSize === 0 || file.size <= this.maxfileSize)
                {
                  log.message = 'success';
                  this.filesLog.success += 1
                  this.files.push({ data: file, state: 'in', 
                  inProgress: false, progress: 0, canRetry: false, canCancel: true });
                 
                }else{
                  log.message = 'error'
                  this.filesLog.error += 1
                  
                }
                this.filesLog.files.push(log)
                console.log(this.files);
                this.filesLog.total += 1
               
          }
          console.log(this.filesLog);
          this.uploadFiles();
    };
    fileUpload.click();
}

cancelFile(file: FileUploadModel) {
    file.sub.unsubscribe();
    this.removeFileFromArray(file);
}

retryFile(file: FileUploadModel) {
    this.uploadFile(file);
    file.canRetry = false;
}

private uploadFile(file: FileUploadModel) {
    const fd = new FormData();
    fd.append(this.param, file.data);

    const req = new HttpRequest('POST', this.target, fd, {
          reportProgress: true
    });

    file.inProgress = true;
    file.sub = this._http.request(req).pipe(
          map(event => {
                switch (event.type) {
                      case HttpEventType.UploadProgress:
                            file.progress = Math.round(event.loaded * 100 / event.total);
                            break;
                      case HttpEventType.Response:
                            return event;
                }
          }),
          tap(message => { }),
          last(),
          catchError((error: HttpErrorResponse) => {
                file.inProgress = false;
                file.canRetry = true;
                return of(`${file.data.name} upload failed.`);
          })
    ).subscribe(
          (event: any) => {
                if (typeof (event) === 'object') {
                      this.removeFileFromArray(file);
                      this.complete.emit(event.body);
                }
          }
    );
}

private uploadFiles() {
    const fileUpload = document.getElementById('fileUpload') as HTMLInputElement;
    fileUpload.value = '';

    this.files.forEach(file => {
          this.uploadFile(file);
    });
}

private removeFileFromArray(file: FileUploadModel) {
    const index = this.files.indexOf(file);
    if (index > -1) {
          this.files.splice(index, 1);
    }
}



/** end upload methods */
     
  ngOnInit() {
    WidgetArrayInstance[this.id] = this as IWidget; 
    this.config = {
      name: 'pcap-import',
     config: this.config
    }


  if (!this.config) {
      this.title = this.config.title || 'PCAP IMPORT';
   
  }
  this.subsDashboardEvent = this._dashboardService.dashboardEvent.subscribe(this.onDashboardEvent.bind(this));
  
  }

  private async onDashboardEvent(data: any) {
    const dataId = data.resultWidget[this.id];
    if (dataId && dataId.query) {
      if (this.lastTimestamp * 1 === dataId.timestamp * 1) {
        return;
      }
      this.lastTimestamp = dataId.timestamp * 1;
      this.localData = dataId.query;
    }
 
  }

  private saveConfig() {
    const _f = Functions.cloneObject;
    this.config = {
      title: this.title || this.id
    };
  
    this.changeSettings.emit({
      config: _f(this.config),
      id: this.id
    });
  }

  async openDialog() {
    const dialogRef = this.dialog.open(SettingPcapImportWidgetComponent, {
      data: {
        title: this.title || this.id,
        maxfileSize: this.maxfileSize * 1|| 0
      }
    });
    const result = await dialogRef.afterClosed().toPromise();
    if (!result) {
      return;
    }
    this.title = result.title;
    this.saveConfig();
  }

  onFileComplete(data: any) {
    console.log(data); // We just print out data bubbled up from event emitter.
  }

  ngOnDestroy() {
    this.subsDashboardEvent.unsubscribe()
   
    }
  }