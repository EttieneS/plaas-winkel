import { Component, inject } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';

import { Sidebar } from '../sidebar/sidebar';
import { Topbar } from '../topbar/topbar';

@Component({
    selector: 'app-main-layout',
    imports: [
        RouterOutlet,
        MatSidenavModule,
        Sidebar,
        Topbar
    ],
    templateUrl: './main-layout.html',
    styleUrl: './main-layout.scss'
})
export class MainLayout {
    readonly compact = toSignal(inject(BreakpointObserver).observe('(max-width: 767px)'));
}
