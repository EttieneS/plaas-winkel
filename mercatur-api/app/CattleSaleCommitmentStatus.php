<?php

namespace App;

enum CattleSaleCommitmentStatus: string
{
    case Pending = 'PENDING';
    case Confirmed = 'CONFIRMED';
    case Cancelled = 'CANCELLED';
}
