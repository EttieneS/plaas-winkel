<?php

namespace App;

enum CattleSaleStatus: string
{
    case Open = 'OPEN';
    case FullyCommitted = 'FULLY_COMMITTED';
}
