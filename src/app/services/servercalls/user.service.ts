import { LOCAL_STORAGE } from '@ng-toolkit/universal';
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import  'rxjs/add/operator/map';
import { Observable } from 'rxjs/Observable';
import { environment } from '../../../environments/environment.prod';
import { Inject } from '@angular/core';

@Injectable()
export class UserService {
  headers1: HttpHeaders;
  id: string;
  userId: string;
  baseUrl = environment.baseUrl;


  constructor(
    @Inject(LOCAL_STORAGE) 
    private localStorage: any, 
    private http:HttpClient
  ) {
    this.userId = localStorage.getItem('lsaUserId');
    this.headers1= new HttpHeaders({'Authorization': "Bearer "+localStorage.getItem('lsaToken_access')});
   }

  // User basic information
  showUserInfo(){
    return this.http.get(this.baseUrl+'/usersinfo/'+this.userId, {headers: this.headers1})
  }

  updateUserInfo(a){
    return this.http.put(this.baseUrl+'/usersinfo/'+this.userId, a, {headers: this.headers1} )
  }

  // User Change Password
  updateUserPassword(a){
    return this.http.put(this.baseUrl+'/userpasswordchange/'+this.userId, a, {headers: this.headers1})
  }

  // User Edit Photos
  updateUserPhoto(aa) {
    console.log('update photos');
    console.log(aa);
    console.log(this.headers1);
    return this.http.post(this.baseUrl+'/users/'+this.userId+'/picture', aa, {headers: this.headers1});
  }

  // User Disucssions
  storeUserDiscussion(aa){
    return this.http.post(this.baseUrl+'/users/'+this.userId+'/discussions', aa,  {headers: this.headers1})
  }

  updateUserDiscussion(aa){
    return this.http.put(this.baseUrl+'/users/'+this.userId+'/discussions', aa,  {headers: this.headers1})
  }

  storeUserDiscussionComment(discussionId, aa){
    return this.http.post(this.baseUrl+'/users/'+this.userId+'/discussions/'+discussionId+'/comment', aa,  {headers: this.headers1})
  }

  // return all discussions
  showDiscussions(categories,uuserId,page){
    let sCategories='';
    let sUserId='';    
    let sPags='';
    if (categories==='All Discussion Types'){ sCategories='?category=' }
    else{ sCategories='?category='+categories; }
    if (uuserId==='All'){ sUserId='&userid=' }
    else{ sUserId='&userid='+this.userId; }
    sPags = '&page='+page;
    console.log(this.baseUrl+'/discussions'+sCategories+sUserId+sPags);
    return this.http.get(this.baseUrl+'/discussions'+sCategories+sUserId+sPags, {headers: this.headers1})
  }

  // return all discussions by two-digits discussionID
  showDiscussion(discussionId){
    return this.http.get(this.baseUrl+'/discussions/'+discussionId, {headers: this.headers1})
  }
  getContacts() {
    if (localStorage.lsaWho == "3") {
      return this.http.get(this.baseUrl + '/tutors/' + this.userId + '/contacts', { headers: this.headers1 })

    } else
      return this.http.get(this.baseUrl + '/learners/' + this.userId + '/contacts', { headers: this.headers1 })
  }
  getAwards(){
    return this.http.get(this.baseUrl+'/allawards', {headers: this.headers1})
  }
}