import { Component } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { DEMO_SALES } from '../sales.data';

@Component({
  imports: [CurrencyPipe, RouterLink, MatTableModule, MatButtonModule],
  selector: 'app-index',
  styleUrl: './index.scss',
  templateUrl: './index.html',
})
export class Index {
  readonly sales = DEMO_SALES;
  readonly columns = ['picture', 'name', 'farm', 'price', 'actions'];
}
