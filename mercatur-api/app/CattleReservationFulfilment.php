<?php

namespace App;

enum CattleReservationFulfilment: string
{
    case Unfulfilled = 'UNFULFILLED';
    case Collected = 'COLLECTED';
    case Delivered = 'DELIVERED';
}
