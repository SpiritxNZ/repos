import { LOCAL_STORAGE } from '@ng-toolkit/universal';
import { Component, OnInit, Input, Output, EventEmitter, Inject, PLATFORM_ID } from '@angular/core';
import * as moment from 'moment';
import { MatDialog, MatDialogRef } from '@angular/material';
import { TutorService } from '../../../../services/servercalls/tutor.service';
import { CalendarSupportService } from '../../../../services/support/calendar-support.service';
import { LearnerService } from '../../../../services/servercalls/learner.service';
import { CommonSupportService } from '../../../../services/support/common-support.service';
import { TutorReportDialogComponent } from '../../dashboard-dialogs/tutor-report-dialog/tutor-report-dialog.component';
import { SessionEditDialogComponent } from '../../dashboard-dialogs/session-edit-dialog/session-edit-dialog.component';
import { CancelSessionDialogComponent } from '../../dashboard-dialogs/cancel-session-dialog/cancel-session-dialog.component';
import { ReportSessionIssueDialogComponent } from '../../dashboard-dialogs/report-session-issue-dialog/report-session-issue-dialog.component';
import { LearnerSessionRatingDialogComponent } from '../../dashboard-dialogs/learner-session-rating-dialog/learner-session-rating-dialog.component';
import { isPlatformBrowser } from '@angular/common';
import { copyStyles } from '@angular/animations/browser/src/util';
import { MessengerHelperService } from '../../../../services/helpers/messenger-helper.service';

@Component({
  selector: 'app-dashboard-home-sessions',
  templateUrl: './dashboard-home-sessions.component.html',
  styleUrls: ['./dashboard-home-sessions.component.css']
})
export class DashboardHomeSessionsComponent implements OnInit {

  // See if client is using browser (SSR)
  isBrowser = false

  constructor(
    @Inject(PLATFORM_ID) private platformId,
    @Inject(LOCAL_STORAGE) private localStorage: any,
    private tutorService: TutorService,
    private dialog: MatDialog,
    private calendarService: CalendarSupportService,
    private learnerService: LearnerService,
    private imageService: CommonSupportService,
    private messengerHelperService: MessengerHelperService    
  ) {
    this.role = Number(localStorage.getItem('lsaWho'));
    if (isPlatformBrowser(this.platformId)) {
      this.isBrowser = true
    }
  }
  sessionsInfo = []; // tutor role and learner role
  range = [];
  now: any;
  showEdit = false;
  mySessions = []; // store the session generated by fullcalender
  calendarEvents = []; // tutor role
  @Input() locations = []; // tutor role
  myLocations = []; // learner role: store location object with tutor id
  freeEvents = []; // learner role: store freeEvents object with tutor id
  baseUrl = 'http://learnspace.co.nz/api/public/';
  sucSubmit = false;
  role: number;
  @Output() s_indicatorEvent = new EventEmitter();
  ngOnInit() {
    console.log(this.locations);
    this.range = this.getRange();
    if (this.role === 3) {
      console.log(this.role, 'I am a tutor.');
      // get sessions info
      this.getSessionInfo();
      // get schedules info, used for fullcalendar
      this.getSchedulesInfo();
    }
    if (this.role === 1 || this.role === 2) {
      console.log(this.role, 'I am a learner.');
      this.getLearnerSessionInfo();
      // this.getInfoShedules();
    }
  }
  // --------------------- Event trigger methods ---------------------------------------------------
  // user clicks the reschedule button, show fullcalendar
  showFullcalender(event) {
    let sessionID = Number(event.srcElement.id.slice(3));
    console.log(sessionID);
    let selectedSession = this.getSession(this.sessionsInfo, sessionID);
    console.log(sessionID, selectedSession);
    /*when user clicks edit button, add the session times to free events firstly, if the user didn't
    change the time, then remove free time when user clicks cancel button on the dialog */
    let times = selectedSession.session_times;
    let tutorID = selectedSession.tutor_id;
    console.log(tutorID);
    // tutor role: generate dialog and process data after dialog closed
    if (this.role === 3) {
      this.processDialog(selectedSession, this.calendarEvents, this.locations, times, this.role);
    }
    // learner role: henerate dialog and process data after dialog closed, must inside the subscribe function
    if (this.role === 1 || this.role === 2) {
      this.getInfoShedules(tutorID, times, selectedSession);
    }
  }
  // user click confirm button
  confirmSession(event) {
    let sessionID = Number(event.srcElement.id.slice(3));
    let data = {
      s_status: 'confirm'
    };
    // update text which is related to html
    // this.updateText(data, sessionID);
    this.updateStatus(data, this.sessionsInfo, sessionID);
    console.log(sessionID, data, this.role);
    // send to server
    this.sendStatus(sessionID, data, this.role);
  }
  // user click cancel button
  cancelSession(event) {
    let sessionID = Number(event.srcElement.id.slice(3));
    let data = {
      s_status: 'cancel'
    };
    // get the withinTwelveHours value for the session
    let selectedSession = this.getSession(this.sessionsInfo, sessionID);
    // console.log(sessionID, selectedSession);
    let withinTwelveHours = selectedSession.withinTwelveHours;
    // console.log(sessionID, selectedSession, withinTwelveHours);
    // show confirmation dialog
    let dialogRef = this.dialog.open(CancelSessionDialogComponent,
      {
        panelClass: 'dialog1',
        data: [sessionID, data, withinTwelveHours],
      });
    dialogRef.afterClosed().subscribe(
      (res) => {
        console.log(res);
        if (res === 'yes') {
          // update text which is related to html
          // this.updateText(data, sessionID);
          this.updateStatus(data, this.sessionsInfo, sessionID);
          // send to server
          console.log(res);
          this.sendStatus(sessionID, data, this.role);
        } else if (res === true) {
          console.log('did reschedule +++++++');
          this.showFullcalender(event);
        }
      },
      (err) => console.warn(err)
    );
  }
  // --------------------- Support Methods ------------------------------------------------------
  // process dialog fullcalendar
  processDialog(selectedSession: any, calendarEvents: any, locations: any, times: any, role: any) {
    this.addFreetimes(calendarEvents, times);
    // console.log(this.calendarEvents);
    let dialogRef = this.dialog.open(SessionEditDialogComponent,
      {
        panelClass: 'dialog2',
        // data: [1 / 1, this.profile_photo],
        data: [selectedSession, calendarEvents, locations, role],
        // disableClose: true
      });
    dialogRef.afterClosed().subscribe(
      (res) => {
        console.log('Dialog closed now!!!');
        // if it was 1, user clicks cancel button; if 2, user clicks save button but changed nothing
        console.log(res);
        if (res && res !== '1' && res !== '2') {
          console.log(111);
          // 1. remove cancel/confim options
          if (this.isBrowser) {
            this.removeOptions(res[0]);
          }
          // 2. update this.sessionInfo because it is connected to the html template,using local session obj
          this.updateSessions(this.sessionsInfo, res[0]);
          console.log(this.sessionsInfo);
          // send to server, because res is an array, using utc_session obj
          let id = Object.keys(res[1])[0];
          let data = res[1][id];
          console.log(id, data);
          this.sendTimeLocation(id, data, this.role);
        } else {
          // user clicks outside dialog or esc key to close the dialog
          if (res !== '1' && res !== '2') {
            if (role === 3) {
              console.log(this.calendarEvents);
              this.changeTutorEvents(this.calendarEvents);
            }
            if (role === 1 || role === 2) {
              console.log(this.freeEvents);
              this.changeAllTutorEvents(this.freeEvents);
            }
          }
        }
      },
      (err) => console.warn(err)
    );
  }
  sendStatus(id: any, data: Object, role: any) {
    if (Object.keys(data).length !== 0) {
      if (role === 3) {
        console.log('Now sending status');
        this.tutorService.updateTutorSessionStatus(id, data).subscribe(
          (res) => {
            // show successfully message
            this.sucSubmit = true;
            console.log(res);
            console.log('Successfully sent data!');
          }
          , (err) => { console.warn(err); }
        );
      }
      if (role === 1 || role === 2) {
        console.log('post learner update!!!');
        this.learnerService.updateLearnerSessionStatus(id, data).subscribe(
          (res) => {
            // show successfully message
            this.sucSubmit = true;
            console.log(res);
            console.log('Successfully sent data!');
          }
          , (err) => { console.warn(err); }
        );
      }
    }
  }
  sendReport(id: number, data: object) {
    this.tutorService.storeTutorSessionReport(id, data).subscribe(
      (res) => {
        console.log(res);
        console.log('Successfully sent report!');
      }
      , (err) => { console.warn(err); }
    );
  }
  sendTimeLocation(id: any, data: Object, role: any) {
    if (Object.keys(data).length !== 0) {
      if (role === 3) {
        this.tutorService.updateTutorSessionTimelocation(id, data).subscribe(
          (res) => {
            // show successfully message
            this.sucSubmit = true;
            console.log(res);
            console.log('Successfully sent data!');
          }
          , (err) => { console.warn(err); }
        );
      }
      if (role === 1 || role === 2) {
        console.log('post learner update!!!');
        this.learnerService.updateLearnerSessionTimelocation(id, data).subscribe(
          (res) => {
            // show successfully message
            this.sucSubmit = true;
            console.log(res);
            console.log('Successfully sent data!');
          }
          , (err) => { console.warn(err); }
        );
      }
    }
  }
  // change all calendar events to free, because user clicks outside the dialog or esc key,
  // in case he clicks the time and changed the color
  // tutor role:
  changeTutorEvents(events: any[]) {
    for (let event of events) {
      if (event.color === '#00ddff') {
        event.color = '#00ad2b';
      }
    }
  }
  // learner role:
  changeAllTutorEvents(tutors: any[]) {
    for (let tutor of tutors) {
      // as tutor is an object, event only one propery, we need to use for loop to get its value
      // tslint:disable-next-line:forin
      for (let id in tutor) {
        // console.log(tutor[id]);
        this.changeTutorEvents(tutor[id]);
      }
    }
  }
  // tutor role: get tutor sessions information
  getSessionInfo() {
    console.log(this.range);
    this.tutorService.indexTutorSessions(this.range).subscribe((res) => {
      // console.log(res['dataCon']);
      let allSessions = res['dataCon'];
      console.log(allSessions);
      let fiveSessions = this.getFiveSessions(allSessions);
      // console.log(fiveSessions);
      this.sessionsInfo = this.changeFormat(fiveSessions);
      console.log(this.sessionsInfo);
      // hide 'no sessions yet' message
      if (this.sessionsInfo.length !== 0) {
        this.s_indicatorEvent.emit(true);
      }
    }, (error) => {
      console.log(error);
    });
  }
  // tutor role: get tutor schedules
  getSchedulesInfo() {
    // get tutor schedules
    this.tutorService.showTutorSchedules().subscribe(
      (res) => {
        // this.locations = res['data'].thisTutorProfile.teaching_locations;
        let eventContainer = this.calendarService.getEvent(res['tutorFreeTime'],res['tutorSessions']);
        console.log(eventContainer);
        this.calendarEvents = eventContainer.free;
        // only after get schedules data, then show the edit button
        this.showEdit = true;
        // console.log(this.calendarEvents);
        // console.log('edit coming');
      }, (error) => console.log(error));
  }
  // learner role: get learner sessions information
  getLearnerSessionInfo() {
    this.learnerService.indexLearnerSessions(this.range).subscribe((res) => {
      // console.log(res['dataCon']);
      let allSessions = res['dataCon'];
      console.log(allSessions);
      let fiveSessions = this.getFiveSessions(allSessions);
      // console.log(fiveSessions);
      this.sessionsInfo = this.changeFormat(fiveSessions);
      console.log(this.sessionsInfo);
      // hide 'no sessions yet' message
      if (this.sessionsInfo.length !== 0) {
        this.s_indicatorEvent.emit(true);
        this.showEdit = true;
      }
    }, (error) => {
      console.log(error);
    });
  }
  // learner role: used to get a specific tutor schedules
  getInfoShedules(tutorID: string, times: any[], selectedSession: any) {
    // myEvents is the freeEvents of the tutor, and used to pass to dialog fullcalendar
    let myEvents = [];
    let myLocs = [];
    console.log('find a tutor', tutorID, this.freeEvents);
    // check if alreay have the tutor schedules
    if (this.findTutor(this.freeEvents, tutorID)) {
      console.log('found');
      myEvents = this.findTutor(this.freeEvents, tutorID)[tutorID];
      myLocs = this.findTutor(this.myLocations, tutorID)[tutorID];
      console.log(myEvents);
      console.log(myLocs);
      // pass to dialog
      this.processDialog(selectedSession, myEvents, myLocs, times, this.role);
    } else {
      // if not found, then go to server to get the data
      this.learnerService.showSchedule(tutorID).subscribe(
        (res) => {
          console.log(res);
          let loc = res['dataCon'].tutorProfile.teaching_locations;
          
          // store the free events into 'freeEvents' variable
          let eventContainer = this.calendarService.getEvent(res['tutorFreeTime'],res['tutorSessions']);
          let free = eventContainer.free;
          let freeObj = {};
          freeObj[tutorID] = free;
          this.freeEvents.push(freeObj);
          // store locations into 'myLocations' variable
          let locObj = {};
          locObj[tutorID] = loc;
          this.myLocations.push(locObj);
          // console.log(this.freeEvents);
          // console.log(this.myLocations);
          // update freeevents and locations
          myEvents = free;
          myLocs = loc;
          console.log(myEvents);
          console.log(myLocs);
          // pass to dialog
          this.processDialog(selectedSession, myEvents, myLocs, times, this.role);
        }, (error) => console.log(error));
    }
  }
  // learner role: find if already get the tutor schedules from server
  findTutor(array: any[], tutorID: string) {
    for (let eventObj of array) {
      if (eventObj.hasOwnProperty(tutorID)) {
        return eventObj;
      }
    }
    return false;
  }
  // get user image url
  getURL(id: string): string {
    let imageURL = this.baseUrl + 'userimg/' + id + '-cp.jpeg';
    return imageURL;
  }
  // change sessions object to another format which sepertate the date and time
  changeFormat(fiveSessions: any) {
    let newSessions = fiveSessions.map(e => {
      let newObj = {};
      // let sessionDate = e.session_date.slice(0, 10);
      // let sessionTime = e.session_date.slice(11);
      // let date = sessionDate + 'T' + sessionTime;
      let date = this.changeToMoment(e.session_date);
      let newDate = date.format('LL');
      let startTime = date.format('LT');
      let endTime = date.add(e.session_duration, 'hours').format('LT');
      let times = this.getTimes(e);
      let day = date.format('ddd');
      let tutorID = e.tutor_id.toString();
      let tutor_user_id = e.tutor_user_id.toString();
      let learnerID = e.learner_id.toString();
      let update: number = e.last_update_party;
      let tutor_img = this.imageService.findUserImg(tutor_user_id);
      let learner_img = this.imageService.findUserImg(learnerID);
      // set property withinTwelveHours to be boolean
      let now = moment();
      let interval = moment.duration(date.diff(now)).asHours();
      let withinTwelveHours = false;
      if (interval <= 12) {
        withinTwelveHours = true;
      }
      let rate = e.session_rating;

      console.log(interval, withinTwelveHours);
      newObj = {
        session_date: newDate,
        session_startTime: startTime,
        session_endTime: endTime,
        session_id: e.session_id,
        learner_name: e.learner_name,
        tutor_name: e.tutor_name,
        session_subject: e.session_subject,
        session_location: e.session_location,
        session_status: e.session_status,
        session_times: times,
        session_day: day,
        tutor_id: tutorID,
        session_update: update,
        tutor_img: tutor_img,
        learner_img: learner_img,
        withinTwelveHours: withinTwelveHours,
        session_rate:rate,
      };
      return newObj;
    });
    return newSessions;
  }
  // get time slots of one session
  getTimes(session: any) {
    let timesArray = [];
    let slots = session.session_duration * 2;
    let myDate = this.changeToMoment(session.session_date);
    // console.log(myDate);
    for (let i = 0; i < slots; i++) {
      timesArray.push(myDate.format().substr(0, 19));
      myDate.add(30, 'minutes');
    }
    return timesArray;
  }
  // get five sessions with is nearest to now, maximum two before now, total max 5 sessions
  getFiveSessions(allSessions: any) {
    let allSessionslength = allSessions.length;
    let firstIndex = this.findFirstIndex(allSessions);
    let fiveSessions = [];
    if (firstIndex === 1) {
      fiveSessions.push(allSessions[firstIndex - 1]);
    }
    if (firstIndex >= 2) {
      fiveSessions.push(allSessions[firstIndex - 1]);
      fiveSessions.push(allSessions[firstIndex - 2]);
    }
    // all in all, the total quantity cannot excees five
    for (let i = firstIndex; i < allSessionslength; i++) {
      fiveSessions.push(allSessions[i]);
      if (fiveSessions.length === 5) {
        break;
      }
    }
    // console.log(fiveSessions);
    return fiveSessions;
  }
  // find first after now element index
  findFirstIndex(allSessions: any) {
    let firstIndex = 0;
    for (let session of allSessions) {
      let myTime = session.session_date;
      let date = this.changeToMoment(myTime);
      if (date.isSameOrAfter(this.now)) {
        firstIndex = allSessions.indexOf(session);
        break;
      }
    }
    return firstIndex;
  }
  // get the start date and end date for get request
  getRange() {
    let range = [];
    this.now = moment();
    // two days before now, and five days after today
    let startDate = this.now.subtract(2, 'days').format().substr(0, 19);
    let endDate = this.now.add(7, 'days').format().substr(0, 19);
    range.push(startDate);
    range.push(endDate);
    // change now to original
    this.now.subtract(5, 'days');
    return range;
  }
  // update text and their color of selections
  updateText(selection: Object, sessionID: number) {
    let statusLabelID = 'label' + sessionID;
    let status = selection['s_status'];
    if (status === 'confirm') {
      $('#' + statusLabelID).html('<strong style="color: green;">Confirmed</strong>');
    } else {
      $('#' + statusLabelID).html('<strong style="color: red;">Canceled</strong>');
    }
  }
  // change time to moment object format
  changeToMoment(time: any): any {
    let sessionDate = time.slice(0, 10);
    let sessionTime = time.slice(11);
    let date = sessionDate + 'T' + sessionTime;
    // change utc to local date
    let localDate = moment.utc(date).local().format().slice(0, 19);
    return moment(localDate);
  }
  // update buttons through updating the status in sessionInfo which connected to html
  updateStatus(session: Object, mySessions: any[], sessionID: number) {
    let x = this.findSession(mySessions, Number(sessionID));
    console.log('my', x);
    x.session_status = session['s_status'] + 'ed';
  }
  // find the sessionobjec in this.SessionInfo array
  findSession(sessions: any, id: number) {
    let findedSession;
    for (let session of sessions) {
      if (session.session_id === id) {
        findedSession = session;
        break;
      }
    }
    return findedSession;
  }
  // get the session object from sessionInfo using sessionID
  getSession(allSessions: any, id: any) {
    for (let session of allSessions) {
      if (session.session_id === id) {
        return session;
      }
    }
  }
  // update this.sessionInfo
  updateSessions(sessions: any, res: any) {
    // get new session information and change its format
    // if time changed
    let id = Number(Object.getOwnPropertyNames(res)[0]);
    if (res[id].hasOwnProperty('s_date')) {
      console.log(11111111);
      let date = res[id].s_date;
      console.log(date);
      let newDate = moment(date).format('LL');
      let startTime = moment(date).format('LT');
      let duration = res[id].s_duration;
      let endTime = moment(date).add(duration, 'hours').format('LT');
      let times = [];
      let day = moment(date).format('ddd');
      for (let x of res[id].s_times) {
        let hour = x.substr(0, 2);
        let minute = x.substr(2, 2);
        let startTime = date.substr(0, 11) + hour + ':' + minute + ':00';
        times.push(startTime);
      }
      console.log(times);
      // update this.sessionInfo
      for (let session of sessions) {
        if (session.session_id === id) {
          session['session_date'] = newDate;
          session['session_endTime'] = endTime;
          session['session_startTime'] = startTime;
          // no matter, time changed or location changed, update the status
          session['session_status'] = 'planned';
          session['session_times'] = times;
          session['session_day'] = day;
          // add a new property to indicate that the session has been updated at least one time
          session['updated'] = 'yes';
        }
      }
    }
    // if location changed
    if (res[id].hasOwnProperty('s_location')) {
      for (let session of sessions) {
        if (session.session_id === id) {
          session['session_location'] = res[id].s_location;
        }
      }
    }
  }
  // remove cancel/confirm options
  removeOptions(res: any) {
    let id = Object.getOwnPropertyNames(res)[0];
    console.log(id);
    console.log('length', $('#act' + id).length);
    // hide cancel and confirm button if they exists
    if ($('#can' + id).length !== 0) {
      $('#can' + id).remove();
    }
    if ($('#con' + id).length !== 0) {
      $('#con' + id).remove();
    }
    $('#suc' + id).html('<p style=\'color: red;\'>New Session</p>');
  }
  addFreetimes(events: any, times: any) {
    // before add times, check if already have this events, if the user second time click edit button, it will have overlap events
    console.log(times);
    for (let time of times) {
      let exist = false;
      for (let event of events) {
        if (event.start === time) {
          exist = true;
        }
      }
      // if not exist, then add to the events
      if (!exist) {
        let endTime = moment(time).add(30, 'minutes').format().substr(0, 19);
        console.log(time, endTime);
        let myObj = {
          title: '',
          start: time,
          end: endTime,
          color: '#00ad2b'
        };
        events.push(myObj);
      }
    }
  }
  // show generate report dialog
  generateReport(event) {
    console.log('report');
    let sessionID = Number(event.srcElement.id.slice(3));
    let dialogRef = this.dialog.open(TutorReportDialogComponent,
      {
        panelClass: 'dialog1',
        data: sessionID,
      });
    dialogRef.afterClosed().subscribe(
      (res) => {
        console.log(res);
        if (res) {
          console.log('got something', res);
          this.sendReport(sessionID, res);
        }
      },
      (err) => console.warn(err)
    );
  }
  reportIssue(event) {
    console.log('report');
    let sessionID = Number(event.srcElement.id.slice(3));
    let dialogRef = this.dialog.open(ReportSessionIssueDialogComponent,
      {
        panelClass: 'dialog1',
        data: sessionID,
      });
    dialogRef.afterClosed().subscribe(
      (res) => {
        console.log(res);
        if (res) {
          console.log('got something', res);
          // this.sendReport(sessionID, res);
        }
      },
      (err) => console.warn(err)
    );
  }
  rateLesson(event, session) {
    console.log('view all session');
    let dialogRef = this.dialog.open(LearnerSessionRatingDialogComponent,
      {
        panelClass: 'dialog1',
        data: {
          tutor_name: session.tutor_name,
          tutor_img: session.tutor_img,
          session_time: session.session_startTime + "-" + session.session_endTime,
          session_date: session.session_date,
          session_location: session.session_location,
          session_id: session.session_id,
        },
      });
    dialogRef.afterClosed().subscribe(
      (res) => {
        console.log("some"+res);
        
      },
      (err) => console.warn(err)
    );
  }
  triggerMessenger(event) {
    let sessionID = Number(event.srcElement.id.slice(3));
    let session_inquestion = this.findSession(this.sessionsInfo, Number(sessionID));
    console.log(session_inquestion);
    // tutor role:
    if (this.role === 3) {
      let learner_id = session_inquestion.learner_id;
      this.changeValue(learner_id);
      console.log(learner_id + 'sent successfully');
    }
    // learner role:
    if (this.role === 1 || this.role === 2) {
      let tutor_id = session_inquestion.tutor_id;
      this.changeValue(tutor_id);
      console.log(tutor_id + 'sent successfully');
    }
  }
  // change the value in the subject behaviour
  changeValue(data: any) {
    let current = this.messengerHelperService.trigger.getValue();
    if (current === 'no') {
      this.messengerHelperService.trigger.next(data);
    } else {
      this.messengerHelperService.trigger.next('no');
    }
  }  
}