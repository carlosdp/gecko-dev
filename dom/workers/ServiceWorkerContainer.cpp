/* -*- Mode: c++; c-basic-offset: 2; indent-tabs-mode: nil; tab-width: 40 -*- */
/* vim: set ts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "ServiceWorkerContainer.h"

#include "nsPIDOMWindow.h"

#include "nsCycleCollectionParticipant.h"

#include "mozilla/dom/Promise.h"
#include "mozilla/dom/ServiceWorkerContainerBinding.h"
#include "mozilla/dom/workers/bindings/ServiceWorker.h"

namespace mozilla {
namespace dom {
namespace workers {

NS_INTERFACE_MAP_BEGIN_CYCLE_COLLECTION_INHERITED(ServiceWorkerContainer)
NS_INTERFACE_MAP_END_INHERITING(DOMEventTargetHelper)

NS_IMPL_ADDREF_INHERITED(ServiceWorkerContainer, DOMEventTargetHelper)
NS_IMPL_RELEASE_INHERITED(ServiceWorkerContainer, DOMEventTargetHelper)

NS_IMPL_CYCLE_COLLECTION_INHERITED(ServiceWorkerContainer, DOMEventTargetHelper, mWindow)

JSObject*
ServiceWorkerContainer::WrapObject(JSContext* aCx)
{
  return ServiceWorkerContainerBinding::Wrap(aCx, this);
}

already_AddRefed<Promise>
ServiceWorkerContainer::Register(const nsAString& aScriptURL,
                                 const RegistrationOptionList& aOptions,
                                 ErrorResult& aRv)
{
  // FIXME(nsm): Bug 984048
  aRv.Throw(NS_ERROR_DOM_NOT_SUPPORTED_ERR);
  return nullptr;
}

already_AddRefed<Promise>
ServiceWorkerContainer::Unregister(const nsAString& aScope,
                                   ErrorResult& aRv)
{
  // FIXME(nsm): Bug 984048
  aRv.Throw(NS_ERROR_DOM_NOT_SUPPORTED_ERR);
  return nullptr;
}

already_AddRefed<workers::ServiceWorker>
ServiceWorkerContainer::GetInstalling()
{
  // FIXME(nsm): Bug 1002570
  return nullptr;
}

already_AddRefed<workers::ServiceWorker>
ServiceWorkerContainer::GetWaiting()
{
  // FIXME(nsm): Bug 1002570
  return nullptr;
}

already_AddRefed<workers::ServiceWorker>
ServiceWorkerContainer::GetCurrent()
{
  // FIXME(nsm): Bug 1002570
  return nullptr;
}

already_AddRefed<Promise>
ServiceWorkerContainer::GetAll(ErrorResult& aRv)
{
  // FIXME(nsm): Bug 1002571
  aRv.Throw(NS_ERROR_DOM_NOT_SUPPORTED_ERR);
  return nullptr;
}

already_AddRefed<Promise>
ServiceWorkerContainer::WhenReady(ErrorResult& aRv)
{
  // FIXME(nsm): Bug 984048
  aRv.Throw(NS_ERROR_DOM_NOT_SUPPORTED_ERR);
  return nullptr;
}

// Testing only.
already_AddRefed<Promise>
ServiceWorkerContainer::ClearAllServiceWorkerData(ErrorResult& aRv)
{
  aRv.Throw(NS_ERROR_DOM_NOT_SUPPORTED_ERR);
  return nullptr;
}

// Testing only.
void
ServiceWorkerContainer::GetControllingWorkerScriptURLForPath(
                                                        const nsAString& aPath,
                                                        nsString& aScriptURL,
                                                        ErrorResult& aRv)
{
  aRv.Throw(NS_ERROR_DOM_NOT_SUPPORTED_ERR);
}
} // namespace workers
} // namespace dom
} // namespace mozilla
