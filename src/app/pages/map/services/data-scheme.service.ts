import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class DataSchemeService {
  constructor(private http: HttpClient) {}

  getSchemeData(id_scheme: number): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      Accept: 'application/json',
    });

    return this.http
      .post(
        `/api/map/data_scheme`,
        { id_scheme },
        { headers, withCredentials: true }
      )
      .pipe(
        catchError((err) => {
          console.error('Ошибка загрузки схемы:', err);
          return throwError(() => new Error('Ошибка загрузки схемы'));
        })
      );
  }

  deleteObjects(
    deletedObjects: { type: string; id: number }[],
    id_scheme: number
  ): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      Accept: 'application/json',
    });

    const payload = {
      data: {
        type: 'FeatureCollection',
        id_scheme,
        features: deletedObjects.map((obj) => ({
          id: obj.id,
          name_object_type: obj.type,
          type: 'Feature',
          geometry: null,
          properties: {},
        })),
      },
    };

    return this.http
      .delete(`/api/map/delete_object`, {
        body: payload,
        headers,
        withCredentials: true,
      })
      .pipe(
        catchError((err) => {
          console.error('Ошибка при отправке удалённых объектов:', err);
          return throwError(
            () => new Error('Ошибка при отправке удалённых объектов')
          );
        })
      );
  }

  createObjects(payload: any): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      Accept: 'application/json',
    });

    return this.http
      .post(`/api/map/create_object`, payload, {
        headers,
        withCredentials: true,
      })
      .pipe(
        catchError((err) => {
          console.error('Ошибка при отправке созданных объектов:', err);
          return throwError(
            () => new Error('Ошибка при отправке созданных объектов')
          );
        })
      );
  }

  updateObjects(payload: any): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      Accept: 'application/json',
    });

    return this.http
      .post(`/api/map/update_object`, payload, {
        headers,
        withCredentials: true,
      })
      .pipe(
        catchError((err) => {
          console.error('Ошибка при обновлении объектов:', err);
          return throwError(() => new Error('Ошибка при обновлении объектов'));
        })
      );
  }
}
