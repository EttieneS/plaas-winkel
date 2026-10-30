<?php

namespace App;

enum CattleSaleStatus: string
{
    case Open = 'OPEN';
    case TargetReached = 'TARGET_REACHED';
    case Accepted = 'ACCEPTED';
    case Slaughtered = 'SLAUGHTERED';
    case Processing = 'PROCESSING';
    case ReadyForFulfilment = 'READY_FOR_FULFILMENT';
    case Fulfilled = 'FULFILLED';
}
